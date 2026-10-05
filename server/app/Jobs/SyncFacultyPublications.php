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
        // from real data. The ORCID iD is then read through OpenAlex, which
        // skips whatever Scopus already has and imports the rest without an
        // index claim.
        //
        // The recorded source is the one that actually contributed records, not
        // merely the last call that did not error. An ORCID iD with nothing
        // against it answers 200 and imports nothing, and reporting that as
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
            $n = $this->syncOpenAlex($faculty);
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
     * The works held against a faculty member's ORCID iD, read from OpenAlex.
     *
     * OpenAlex is asked rather than ORCID's own API: the same works, found by
     * the same iD, but the listing carries the DOI, the full author list, the
     * volume and the page range. ORCID's listing has none of those and needed
     * one further request per work for the authors alone. Rows stay recorded
     * as source 'orcid', because the iD is what found them.
     *
     * It is free and needs no key. What it cannot do is say a journal is
     * Scopus indexed, which is why Scopus still runs first and still wins.
     */
    private function syncOpenAlex(Faculty $faculty): int
    {
        try {
            // Rows imported from ORCID's own API were keyed on its put-code,
            // which OpenAlex cannot produce. They are the same works carrying
            // less, so the ones nobody has edited are dropped and re-imported
            // rather than left beside their fuller copies.
            $dropped = FacultyPublication::where('faculty_code', $faculty->faculty_code)
                ->where('external_id', 'LIKE', 'orcid:%')
                ->where('manually_edited', false)
                ->delete();
            if ($dropped) {
                Log::info("Sync openalex for faculty {$faculty->faculty_code}: dropped {$dropped} row(s) left by the older ORCID import");
            }

            // Every DOI already on the record except the ones this source owns,
            // so a paper Scopus supplied, or one somebody edited by hand, is
            // not imported a second time. This source's own rows are left out
            // of the list so that re-running still refreshes them.
            $seenDois = FacultyPublication::where('faculty_code', $faculty->faculty_code)
                ->where(fn ($rows) => $rows->whereNull('external_id')->orWhere('external_id', 'NOT LIKE', 'openalex:%'))
                ->pluck('doi_link')
                ->filter()
                ->map(fn ($doi) => $this->bareDoi($doi))
                ->all();

            $cursor = '*';
            $imported = 0;
            $pages = 0;

            do {
                $response = Http::withHeaders(['Accept' => 'application/json'])->timeout(30)->get(
                    'https://api.openalex.org/works',
                    [
                        'filter' => 'author.orcid:' . $faculty->orcid_id,
                        'per-page' => 200,
                        // Cursor paging, as OpenAlex asks for anything past the
                        // first few pages. 'meta.next_cursor' carries the next.
                        'cursor' => $cursor,
                        // Identifies the portal, which OpenAlex asks callers to do.
                        'mailto' => config('mail.from.address'),
                    ]
                );

                if (!$response->successful()) {
                    Log::warning("OpenAlex sync failed for {$faculty->faculty_code}: HTTP " . $response->status() . " body=" . substr($response->body(), 0, 300));
                    return -1;
                }

                $works = $response->json('results', []);
                foreach ($works as $work) {
                    if ($this->storeOpenAlexWork($faculty, $work, $seenDois)) $imported++;
                }

                $cursor = $response->json('meta.next_cursor');
                $pages++;
                Log::info("Sync openalex page for faculty {$faculty->faculty_code}: page={$pages}, works=" . count($works) . ", stored={$imported}, total=" . $response->json('meta.count', 0));

                // Guard against a cursor that never empties, as the Scopus loop does.
            } while ($cursor && count($works) === 200 && $pages < 10);

            $this->syncOpenAlexMetrics($faculty);

            return $imported;
        } catch (\Throwable $e) {
            Log::warning("OpenAlex sync error for {$faculty->faculty_code}: " . $e->getMessage());
            return -1;
        }
    }

    /**
     * One OpenAlex work, stored unless it is a kind this page does not list or
     * a paper already on the record. Answers whether it was taken.
     */
    private function storeOpenAlexWork(Faculty $faculty, array $work, array $seenDois): bool
    {
        $publicationType = $this->openAlexType((string) ($work['type'] ?? ''));
        if (!$publicationType) return false;

        $doi = $work['doi'] ?? null;
        if ($doi && in_array($this->bareDoi($doi), $seenDois, true)) return false;

        $venue = data_get($work, 'primary_location.source.display_name');
        $firstPage = data_get($work, 'biblio.first_page');
        $lastPage = data_get($work, 'biblio.last_page');

        $this->store($faculty, [
            // "https://openalex.org/W2046851730" reduced to the work's own id.
            'external_id' => 'openalex:' . basename((string) ($work['id'] ?? '')),
            'source' => 'orcid',
            'title' => $work['display_name'] ?? null,
            'name' => $venue,
            'authors' => $this->openAlexAuthors($work),
            'year' => $work['publication_year'] ?? null,
            'doi_link' => $doi,
            'volume' => data_get($work, 'biblio.volume'),
            'page_no' => $firstPage && $lastPage && $firstPage !== $lastPage ? "{$firstPage}-{$lastPage}" : ($firstPage ?: null),
            'issn' => data_get($work, 'primary_location.source.issn_l'),
            'publisher' => data_get($work, 'primary_location.source.host_organization_name'),
            'publication_type' => $publicationType,
            // OpenAlex records no Scopus listing (its source objects carry
            // 'is_core' and 'listed_in', neither of which names Scopus), so a
            // journal paper is left unclassified rather than claimed as
            // indexed. Only Scopus can make that claim, and it runs first.
            'type' => $publicationType === 'conference' ? $this->conferenceScope($venue) : null,
        ]);

        return true;
    }

    /**
     * Citation count and h-index from OpenAlex, written only where the field
     * has been left empty, so a number somebody typed is never replaced.
     */
    private function syncOpenAlexMetrics(Faculty $faculty): void
    {
        if ($faculty->citations !== null && $faculty->h_index !== null) return;

        try {
            $response = Http::withHeaders(['Accept' => 'application/json'])->timeout(15)->get(
                'https://api.openalex.org/authors/orcid:' . $faculty->orcid_id,
                ['mailto' => config('mail.from.address')]
            );

            if (!$response->successful()) return;

            $citations = $response->json('cited_by_count');
            $hIndex = $response->json('summary_stats.h_index');

            if ($faculty->citations === null && $citations !== null) $faculty->citations = $citations;
            if ($faculty->h_index === null && $hIndex !== null) $faculty->h_index = $hIndex;

            if ($faculty->isDirty()) {
                $faculty->save();
                Log::info("Sync openalex metrics for faculty {$faculty->faculty_code}: citations={$faculty->citations}, h_index={$faculty->h_index}");
            }
        } catch (\Throwable $e) {
            Log::warning("OpenAlex metrics error for faculty {$faculty->faculty_code}: " . $e->getMessage());
        }
    }

    /**
     * Which of this page's kinds a work belongs to, or null for a kind the
     * profile does not list: a preprint, dataset, peer review, erratum or
     * editorial is not a publication here. OpenAlex holds no patents at all,
     * so those stay hand entered.
     */
    private function openAlexType(string $type): ?string
    {
        return match ($type) {
            'article', 'review' => 'journal',
            'conference-paper' => 'conference',
            'book', 'book-chapter', 'monograph' => 'book',
            default => null,
        };
    }

    /**
     * "Bhatia T.", the style the Scopus import already writes.
     *
     * OpenAlex gives a display name given name first, so the last word is read
     * as the surname. That is wrong for a surname of more than one word, which
     * is one of the reasons a row stays editable.
     */
    private function openAlexAuthors(array $work): ?string
    {
        $names = collect(data_get($work, 'authorships', []))
            ->map(function ($authorship) {
                $full = trim((string) (data_get($authorship, 'author.display_name') ?: data_get($authorship, 'raw_author_name')));
                if ($full === '') return null;

                $parts = preg_split('/\s+/', $full);
                $family = array_pop($parts);

                return $parts ? $family . ' ' . mb_substr($parts[0], 0, 1) . '.' : $family;
            })
            ->filter()
            ->unique()
            ->values();

        return $names->isNotEmpty() ? $names->implode(', ') : null;
    }

    /** A DOI reduced to what two records can be compared on. */
    private function bareDoi(?string $doi): string
    {
        return strtolower(trim(preg_replace('#^https?://(dx\.)?doi\.org/#i', '', (string) $doi)));
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
            try {
                $crossrefAuthors = $this->crossrefAuthors($faculty, $entries);
            } catch (\Throwable $e) {
                Log::warning("Crossref enrichment error for faculty {$faculty->faculty_code}: " . $e->getMessage());
                $crossrefAuthors = [];
            }

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
                    // Stored as written. The column was an integer once, which
                    // is why this stripped the hyphen and the check digit X;
                    // it is text now, so "1234-567X" survives.
                    'issn' => isset($entry['prism:issn']) ? trim($entry['prism:issn']) : null,
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
        try {
            $metrics = Http::withHeaders($headers)->timeout(30)->get(
                "https://api.elsevier.com/content/author/author_id/{$faculty->scopus_id}",
                ['view' => 'METRICS']
            );
            if (!method_exists($metrics, 'successful') || !$metrics->successful()) {
                Log::warning("Scopus metrics failed for faculty {$faculty->faculty_code}: non-response object");
                return;
            }
            $profile = $metrics->json('author-retrieval-response.0', []);
            $citations = data_get($profile, 'coredata.citation-count');
            $hIndex = data_get($profile, 'h-index');
            if (($citations !== null && $citations != $faculty->citations)
                || ($hIndex !== null && $hIndex != $faculty->h_index)) {
                if ($citations !== null) $faculty->citations = $citations;
                if ($hIndex !== null) $faculty->h_index = $hIndex;
                $faculty->save();
                Log::info("Sync scopus metrics for faculty {$faculty->faculty_code}: citations={$faculty->citations}, h_index={$faculty->h_index}");
            }
        } catch (\Throwable $e) {
            Log::warning("Scopus metrics error for faculty {$faculty->faculty_code}: " . $e->getMessage());
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
        if (!$response || !method_exists($response, 'successful') || !$response->successful()) return null;
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
