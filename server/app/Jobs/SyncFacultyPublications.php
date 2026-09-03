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

    // A sync makes one request per Scopus page plus one per ORCID work to read
    // its authors, so a well published faculty member runs well past the 60
    // second default and would be killed halfway through the import.
    public $timeout = 300;

    // store() writes with updateOrCreate keyed on the external id and leaves
    // manually edited rows alone, so re-running after a failed attempt repeats
    // the same result rather than duplicating anything.
    public $tries = 3;

    public function __construct(public int $facultyCode) {}

    public function handle(): void
    {
        $faculty = Faculty::find($this->facultyCode);
        if (!$faculty) {
            Log::warning("Sync aborted: faculty {$this->facultyCode} not found");
            return;
        }
        Log::info("Sync job started for faculty {$faculty->faculty_code} (orcid=".($faculty->orcid_id ?: 'null').", scopus=".($faculty->scopus_id ?: 'null').")");

        // Scopus runs first on purpose. It is the only source that can say a
        // paper is in a Scopus journal, so anything it returns is categorised
        // from real data. ORCID then skips whatever Scopus already has, and its
        // remaining works are imported without an index claim.
        //
        // The recorded source is the one that actually contributed records, not
        // merely the last call that did not error. An ORCID record with nothing
        // public on it answers 200 and imports nothing, and reporting that as
        // "last synced from ORCID" reads as though ORCID supplied the list.
        $imported = [];
        $counts = [];
        $attempted = [];

        if ($faculty->scopus_id && config('services.scopus.key')) {
            $attempted[] = 'scopus';
            Log::info("Sync scopus started for faculty {$faculty->faculty_code} (author_id={$faculty->scopus_id})");
            $n = $this->syncScopus($faculty);
            if ($n >= 0) {
                $counts['scopus'] = $n;
                if ($n > 0) $imported[] = 'scopus';
                Log::info("Sync scopus finished for faculty {$faculty->faculty_code}: {$n} publications stored");
            } else {
                Log::error("Sync scopus failed for faculty {$faculty->faculty_code}");
            }
        }
        if ($faculty->orcid_id) {
            $attempted[] = 'orcid';
            Log::info("Sync orcid started for faculty {$faculty->faculty_code} (orcid={$faculty->orcid_id})");
            $n = $this->syncOrcid($faculty);
            if ($n >= 0) {
                $counts['orcid'] = $n;
                if ($n > 0) $imported[] = 'orcid';
                Log::info("Sync orcid finished for faculty {$faculty->faculty_code}: {$n} publications stored");
            } else {
                Log::error("Sync orcid failed for faculty {$faculty->faculty_code}");
            }
        }

        if ($imported) {
            // Scopus wins when both contributed, since it is the source whose
            // categories are verified.
            $faculty->last_synced_at = now();
            $faculty->last_sync_source = in_array('scopus', $imported, true) ? 'scopus' : 'orcid';
            $faculty->save();
            Log::info("Sync job finished for faculty {$faculty->faculty_code}: scopus=".($counts['scopus'] ?? 0).", orcid=".($counts['orcid'] ?? 0)." (now={$faculty->last_synced_at})");
        } elseif ($attempted) {
            Log::error("Sync job finished for faculty {$faculty->faculty_code} with no records stored (attempted=".implode(',', $attempted).", scopus_key=".(config('services.scopus.key') ? 'set' : 'missing').")");
        } else {
            Log::info("Sync job finished for faculty {$faculty->faculty_code}: nothing to sync (no ids/key)");
        }
    }

    /**
     * ORCID's public record needs no credentials, only the iD.
     */
    private function syncOrcid(Faculty $faculty): int
    {
        try {
            $response = Http::withHeaders(['Accept' => 'application/json'])
                ->timeout(30)
                ->get("https://pub.orcid.org/v3.0/{$faculty->orcid_id}/works");
            if (!$response->successful()) {
                Log::warning("ORCID sync failed for {$faculty->faculty_code}: HTTP " . $response->status() . " body=" . substr($response->body(), 0, 300));
                return -1;
            }
            // DOIs already imported from Scopus, so the same paper is not listed
            // twice under two sources. Scopus knows the journal is indexed; the
            // ORCID copy of the same work does not, so the Scopus one wins.
            $seenDois = FacultyPublication::where('faculty_code', $faculty->faculty_code)
                ->where('source', 'scopus')
                ->pluck('doi_link')
                ->filter()
                ->map(fn ($doi) => strtolower(trim($doi)))
                ->all();

            $groups = $response->json('group', []);
            Log::info("Sync orcid works for faculty {$faculty->faculty_code}: ".count($groups)." groups to process");
            $imported = 0;

            foreach ($groups as $group) {
                $summary = $group['work-summary'][0] ?? null;
                if (!$summary) continue;

                $doi = $this->orcidDoi($summary);
                if ($doi && in_array(strtolower(trim($doi)), $seenDois, true)) {
                    continue;
                }

                $type = $this->orcidType($summary['type'] ?? '');
                $venue = data_get($summary, 'journal-title.value');

                $this->store($faculty, [
                    'external_id' => 'orcid:' . ($summary['put-code'] ?? ''),
                    'source' => 'orcid',
                    'title' => data_get($summary, 'title.title.value'),
                    'name' => $venue,
                    'authors' => $this->orcidAuthors($faculty, $summary['put-code'] ?? null),
                    'year' => data_get($summary, 'publication-date.year.value'),
                    'doi_link' => $doi,
                    'publication_type' => $type,
                    // ORCID carries no indexing information, so a journal article
                    // is left unclassified rather than claimed as Scopus indexed.
                    // A conference is placed by venue name, which is a guess and
                    // is meant to be corrected by hand.
                    'type' => $type === 'conference' ? $this->conferenceScope($venue) : null,
                ]);
                $imported++;
            }

            return $imported;
        } catch (\Throwable $e) {
            Log::warning("ORCID sync error for {$faculty->faculty_code}: " . $e->getMessage());
            return -1;
        }
    }

    private function syncScopus(Faculty $faculty): int
    {
        $headers = array_filter([
            'X-ELS-APIKey' => config('services.scopus.key'),
            'X-ELS-Insttoken' => config('services.scopus.inst_token'),
            'Accept' => 'application/json',
        ]);
        try {
            // STANDARD view: COMPLETE needs an entitlement most keys lack
            // (401). Every field we store lives in STANDARD; only the full
            // author array is COMPLETE-only, and scopusAuthors() already falls
            // back to dc:creator (first author) when it is absent.
            //
            // Keep count at 25: higher values 400 on keys whose service level
            // caps page size below the documented 200 max ("Exceeds the
            // maximum number allowed for the service level").
            $perPage = 25;
            $start = 0;
            $entries = [];

            do {
                $search = Http::withHeaders($headers)->timeout(30)->get(
                    'https://api.elsevier.com/content/search/scopus',
                    [
                        'query' => "AU-ID({$faculty->scopus_id})",
                        'count' => $perPage,
                        'start' => $start,
                        'view' => 'STANDARD',
                    ]
                );

                if (!$search->successful()) {
                    Log::warning("Scopus sync failed for {$faculty->faculty_code}: HTTP " . $search->status() . " body=" . substr($search->body(), 0, 300));
                    return -1;
                }

                $page = $search->json('search-results.entry', []);
                $entries = array_merge($entries, $page);

                $total = (int) $search->json('search-results.opensearch:totalResults', 0);
                Log::info("Sync scopus page for faculty {$faculty->faculty_code}: start={$start}, page=".count($page).", collected=".count($entries).", total={$total}");
                $start += $perPage;

                // Guard against a malformed page that would otherwise loop.
            } while (count($page) === $perPage && $start < $total && $start < 2000);

            // Full author lists live in the COMPLETE view, which needs an
            // entitlement this key may lack (401 from unregistered IPs). The
            // bypass: Crossref resolves authors by DOI for free, no key, no IP
            // gating. Entries that already carry an author array (entitled
            // key) or have no DOI skip the lookup and use the Scopus fields.
            $crossrefAuthors = $this->crossrefAuthors($faculty, $entries);

            $imported = 0;

            foreach ($entries as $idx => $entry) {
                if (isset($entry['error'])) continue;

                $publicationType = $this->scopusType(
                    $entry['subtype'] ?? '',
                    $entry['prism:aggregationType'] ?? ''
                );
                $venue = $entry['prism:publicationName'] ?? null;

                $this->store($faculty, [
                    'external_id' => 'scopus:' . ($entry['eid'] ?? ''),
                    'source' => 'scopus',
                    'title' => $entry['dc:title'] ?? null,
                    'name' => $venue,
                    'authors' => $crossrefAuthors[$idx] ?? $this->scopusAuthors($entry),
                    'year' => substr($entry['prism:coverDate'] ?? '', 0, 4) ?: null,
                    'doi_link' => isset($entry['prism:doi']) ? 'https://doi.org/' . $entry['prism:doi'] : null,
                    'volume' => $entry['prism:volume'] ?? null,
                    'issn' => isset($entry['prism:issn']) ? (int) preg_replace('/\D/', '', $entry['prism:issn']) : null,
                    'publication_type' => $publicationType,
                    // Scopus is the one source that can confirm a journal is
                    // Scopus indexed, which is what 'non-sci' means on this
                    // page. It says nothing about SCI, SSCI, ABDC or AHCI, so
                    // that category is never set automatically.
                    'type' => match ($publicationType) {
                        'journal' => 'non-sci',
                        'conference' => $this->conferenceScope($venue),
                        default => null,
                    },
                ]);
                $imported++;
            }

            try {
                $this->syncScopusMetrics($faculty, $headers);
            } catch (\Throwable $e) {
                Log::warning("Scopus metrics error for faculty {$faculty->faculty_code}: " . $e->getMessage());
            }
            return $imported;
        } catch (\Throwable $e) {
            Log::warning("Scopus sync error for {$faculty->faculty_code}: " . $e->getMessage());
            return -1;
        }
    }

    private function syncScopusMetrics(Faculty $faculty, array $headers): void
    {
        $metrics = Http::withHeaders($headers)->timeout(30)->get(
            "https://api.elsevier.com/content/author/author_id/{$faculty->scopus_id}",
            ['view' => 'METRICS']
        );
        if (!$metrics->successful()) {
            Log::warning("Scopus metrics failed for faculty {$faculty->faculty_code}: HTTP " . $metrics->status());
            return;
        }
        $profile = $metrics->json('author-retrieval-response.0', []);
        $citations = data_get($profile, 'coredata.citation-count');
        $hIndex = data_get($profile, 'h-index');
        // Saved here, not in handle(): metrics must persist even when no new
        // publication rows were written (handle only saves on new imports).
        if (($citations !== null && $citations != $faculty->citations)
            || ($hIndex !== null && $hIndex != $faculty->h_index)) {
            if ($citations !== null) $faculty->citations = $citations;
            if ($hIndex !== null) $faculty->h_index = $hIndex;
            $faculty->save();
            Log::info("Sync scopus metrics for faculty {$faculty->faculty_code}: citations={$faculty->citations}, h_index={$faculty->h_index}");
        }
    }

    /**
     * A synced record is matched on external_id, so re-running never duplicates.
     * Anything typed in by hand keeps its own row and is never overwritten.
     *
     * A row someone has corrected is left exactly as they left it. Neither
     * source can tell SCI from Scopus, or a national conference from an
     * international one, so those corrections are the only accurate data on the
     * row and rewriting them on every sync made the classification pointless.
     * Clearing `manually_edited` puts the row back under the sync's control.
     */
    private function store(Faculty $faculty, array $fields): void
    {
        if (empty($fields['external_id']) || empty($fields['title'])) return;

        $existing = FacultyPublication::where('faculty_code', $faculty->faculty_code)
            ->where('external_id', $fields['external_id'])
            ->first();

        if ($existing && $existing->manually_edited) {
            return;
        }

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

    /**
     * Author lists via Crossref, keyed by the entry index in $entries.
     *
     * Free, keyless and IP-independent, so it works wherever the COMPLETE
     * view 401s. Chunked pools of 10 keep it fast without tripping Crossref's
     * politeness limits; anything without a DOI, or any failed lookup, is
     * simply absent from the map and the caller falls back to dc:creator.
     *
     * @return array<int, string>
     */
    private function crossrefAuthors(Faculty $faculty, array $entries): array
    {
        $targets = [];
        foreach ($entries as $idx => $entry) {
            if (isset($entry['error']) || !empty($entry['author'])) continue;
            if (!empty($entry['prism:doi'])) $targets[$idx] = $entry['prism:doi'];
        }
        if (!$targets) return [];

        $resolved = [];
        $missing = 0;
        foreach (array_chunk($targets, 10, true) as $chunk) {
            $responses = \Illuminate\Support\Facades\Http::pool(function ($pool) use ($chunk) {
                $reqs = [];
                foreach ($chunk as $idx => $doi) {
                    $reqs[$idx] = $pool->as("i{$idx}")->timeout(15)->get('https://api.crossref.org/works/' . $doi);
                }
                return $reqs;
            });
            foreach ($chunk as $idx => $doi) {
                $authors = $this->crossrefAuthorString($responses["i{$idx}"] ?? null);
                if ($authors) $resolved[$idx] = $authors;
                else $missing++;
            }
        }
        Log::info("Sync crossref authors for faculty {$faculty->faculty_code}: enriched ".count($resolved)."/".count($targets).($missing ? " ({$missing} without record)" : ""));
        return $resolved;
    }

    private function crossrefAuthorString($response): ?string
    {
        if (!$response || !$response->successful()) return null;
        $names = collect($response->json('message.author', []))
            ->map(function ($author) {
                $family = trim((string) ($author['family'] ?? $author['name'] ?? ''));
                $given = trim((string) ($author['given'] ?? ''));
                if ($family === '') return null;
                // "Bhatia T." — matches the Scopus authname style.
                return $family . ($given !== '' ? ' ' . mb_substr($given, 0, 1) . '.' : '');
            })
            ->filter()
            ->unique()
            ->values();
        return $names->isNotEmpty() ? $names->implode(', ') : null;
    }

    /**
     * The full author list from a COMPLETE-view entry.
     *
     * Falls back to dc:creator, the first author only, if the author array is
     * absent, which happens when the key is not entitled to the COMPLETE view.
     */
    private function scopusAuthors(array $entry): ?string
    {
        $authors = collect($entry['author'] ?? [])
            ->map(fn ($author) => $author['authname'] ?? $author['ce:indexed-name'] ?? null)
            ->filter()
            ->unique()
            ->values();

        if ($authors->isNotEmpty()) {
            return $authors->implode(', ');
        }

        return $entry['dc:creator'] ?? null;
    }

    /**
     * ORCID's works listing carries no contributors, so the full record has to
     * be fetched per work. One extra request each, which is why a failure here
     * is swallowed: an author list is worth having but not worth losing the
     * publication over.
     */
    private function orcidAuthors(Faculty $faculty, $putCode): ?string
    {
        if (!$putCode) return null;

        try {
            $response = Http::withHeaders(['Accept' => 'application/json'])
                ->timeout(15)
                ->get("https://pub.orcid.org/v3.0/{$faculty->orcid_id}/work/{$putCode}");

            if (!$response->successful()) return null;

            $names = collect($response->json('contributors.contributor', []))
                ->map(fn ($contributor) => data_get($contributor, 'credit-name.value'))
                ->filter()
                ->unique()
                ->values();

            return $names->isNotEmpty() ? $names->implode(', ') : null;
        } catch (\Throwable $e) {
            Log::warning("ORCID contributors failed for work {$putCode}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Whether a conference looks national or international, from its name.
     *
     * Neither ORCID nor Scopus records this, so it is a guess and is wrong in
     * both directions: an international conference held in India reads as
     * national, and a national conference that never says so reads as
     * international. It is here because a bucket has to be chosen, and it is
     * deliberately the only place that decides, so changing the rule or
     * dropping it means editing one method.
     */
    private function conferenceScope(?string $venue): string
    {
        $name = strtolower((string) $venue);

        if ($name === '') return 'international';

        // "International" wins when both words appear, which is common in
        // titles like "National Conference on ... International Track".
        if (str_contains($name, 'international') || str_contains($name, ' ieee ')) {
            return 'international';
        }
        if (str_contains($name, 'national')) {
            return 'national';
        }

        return 'international';
    }

    /**
     * Scopus subtype, cross-checked against the aggregation type.
     *
     * The subtype says what the item is (ar, cp, ch, bk, re, ed) and the
     * aggregation type says what it appeared in (Journal, Conference
     * Proceeding, Book, Book Series). A review published in a conference
     * proceeding is a conference paper, so the container is trusted first.
     */
    private function scopusType(string $subtype, string $aggregationType = ''): string
    {
        // The subtype says what the item is; the aggregation type only says what
        // it was printed in. Conference proceedings are routinely published as a
        // book series (Lecture Notes in Computer Science, Advances in
        // Intelligent Systems and Computing), so trusting the container first
        // turned genuine conference papers into book chapters.
        switch ($subtype) {
            case 'cp': return 'conference';
            case 'ch':
            case 'bk': return 'book';
        }

        // Only when the subtype says nothing useful does the container decide.
        $container = strtolower($aggregationType);
        if (str_contains($container, 'conference')) return 'conference';
        if (str_contains($container, 'book')) return 'book';

        return 'journal';
    }
}
