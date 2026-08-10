<?php
namespace App\Jobs;

use App\Models\Faculty;
use App\Models\FacultyPublication;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SyncFacultyPublications implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $facultyCode) {}

    public function handle(): void
    {
        $faculty = Faculty::find($this->facultyCode);
        if (!$faculty) return;

        $source = null;
        if ($faculty->orcid_id) {
            $source = $this->syncOrcid($faculty) ? 'orcid' : $source;
        }
        if ($faculty->scopus_id && config('services.scopus.key')) {
            $source = $this->syncScopus($faculty) ? 'scopus' : $source;
        }

        if ($source) {
            $faculty->last_synced_at = now();
            $faculty->last_sync_source = $source;
            $faculty->save();
        }
    }

    /**
     * ORCID's public record needs no credentials, only the iD.
     */
    private function syncOrcid(Faculty $faculty): bool
    {
        try {
            $response = Http::withHeaders(['Accept' => 'application/json'])
                ->timeout(30)
                ->get("https://pub.orcid.org/v3.0/{$faculty->orcid_id}/works");
            if (!$response->successful()) {
                Log::warning("ORCID sync failed for {$faculty->faculty_code}: HTTP " . $response->status());
                return false;
            }
            foreach ($response->json('group', []) as $group) {
                $summary = $group['work-summary'][0] ?? null;
                if (!$summary) continue;
                $this->store($faculty, [
                    'external_id' => 'orcid:' . ($summary['put-code'] ?? ''),
                    'source' => 'orcid',
                    'title' => data_get($summary, 'title.title.value'),
                    'name' => data_get($summary, 'journal-title.value'),
                    'year' => data_get($summary, 'publication-date.year.value'),
                    'doi_link' => $this->orcidDoi($summary),
                    'publication_type' => $this->orcidType($summary['type'] ?? ''),
                ]);
            }
            return true;
        } catch (\Throwable $e) {
            Log::warning("ORCID sync error for {$faculty->faculty_code}: " . $e->getMessage());
            return false;
        }
    }

    private function syncScopus(Faculty $faculty): bool
    {
        $headers = array_filter([
            'X-ELS-APIKey' => config('services.scopus.key'),
            'X-ELS-Insttoken' => config('services.scopus.inst_token'),
            'Accept' => 'application/json',
        ]);
        try {
            $search = Http::withHeaders($headers)->timeout(30)->get(
                'https://api.elsevier.com/content/search/scopus',
                ['query' => "AU-ID({$faculty->scopus_id})", 'count' => 200]
            );
            if (!$search->successful()) {
                Log::warning("Scopus sync failed for {$faculty->faculty_code}: HTTP " . $search->status());
                return false;
            }
            foreach ($search->json('search-results.entry', []) as $entry) {
                if (isset($entry['error'])) continue;
                $this->store($faculty, [
                    'external_id' => 'scopus:' . ($entry['eid'] ?? ''),
                    'source' => 'scopus',
                    'title' => $entry['dc:title'] ?? null,
                    'name' => $entry['prism:publicationName'] ?? null,
                    'authors' => $entry['dc:creator'] ?? null,
                    'year' => substr($entry['prism:coverDate'] ?? '', 0, 4) ?: null,
                    'doi_link' => isset($entry['prism:doi']) ? 'https://doi.org/' . $entry['prism:doi'] : null,
                    'volume' => $entry['prism:volume'] ?? null,
                    'issn' => isset($entry['prism:issn']) ? (int) preg_replace('/\D/', '', $entry['prism:issn']) : null,
                    'publication_type' => $this->scopusType($entry['subtype'] ?? ''),
                ]);
            }
            $this->syncScopusMetrics($faculty, $headers);
            return true;
        } catch (\Throwable $e) {
            Log::warning("Scopus sync error for {$faculty->faculty_code}: " . $e->getMessage());
            return false;
        }
    }

    private function syncScopusMetrics(Faculty $faculty, array $headers): void
    {
        $metrics = Http::withHeaders($headers)->timeout(30)->get(
            "https://api.elsevier.com/content/author/author_id/{$faculty->scopus_id}",
            ['view' => 'METRICS']
        );
        if (!$metrics->successful()) return;
        $profile = $metrics->json('author-retrieval-response.0', []);
        $faculty->citations = data_get($profile, 'coredata.citation-count') ?? $faculty->citations;
        $faculty->h_index = data_get($profile, 'h-index') ?? $faculty->h_index;
    }

    /**
     * A synced record is matched on external_id, so re-running never duplicates.
     * Anything typed in by hand keeps its own row and is never overwritten.
     */
    private function store(Faculty $faculty, array $fields): void
    {
        if (empty($fields['external_id']) || empty($fields['title'])) return;
        FacultyPublication::updateOrCreate(
            ['faculty_code' => $faculty->faculty_code, 'external_id' => $fields['external_id']],
            array_merge($fields, ['verified' => true])
        );
    }

    private function orcidDoi(array $summary): ?string
    {
        foreach (data_get($summary, 'external-ids.external-id', []) as $id) {
            if (($id['external-id-type'] ?? '') === 'doi') {
                return 'https://doi.org/' . ($id['external-id-value'] ?? '');
            }
        }
        return null;
    }

    private function orcidType(string $type): string
    {
        // ORCID v3.0 returns lower case, hyphenated values: "journal-article",
        // "conference-paper", "book-chapter". Matching the constant style
        // directly never hit, so every work fell through to 'journal' and
        // conference papers, books and patents were all filed as journal
        // articles. Normalising first fixes that, and still matches if ORCID
        // ever hands back the upper case form.
        $normalised = strtoupper(str_replace('-', '_', trim($type)));

        return match ($normalised) {
            'CONFERENCE_PAPER', 'CONFERENCE_ABSTRACT', 'CONFERENCE_POSTER' => 'conference',
            'BOOK', 'BOOK_CHAPTER', 'EDITED_BOOK' => 'book',
            'PATENT' => 'patent',
            default => 'journal',
        };
    }

    private function scopusType(string $subtype): string
    {
        return match ($subtype) {
            'cp' => 'conference',
            'ch', 'bk' => 'book',
            default => 'journal',
        };
    }
}
