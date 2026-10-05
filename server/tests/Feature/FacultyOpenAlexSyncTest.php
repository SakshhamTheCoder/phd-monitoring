<?php

namespace Tests\Feature;

use App\Jobs\SyncFacultyPublications;
use App\Models\Faculty;
use App\Models\FacultyPublication;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * The works an ORCID iD finds, read through OpenAlex.
 *
 * Rows stay recorded as source 'orcid' because the iD is what found them, so
 * the page's existing source label still reads correctly.
 */
class FacultyOpenAlexSyncTest extends TestCase
{
    use DatabaseTransactions;

    /** A faculty member with an ORCID iD, no Scopus ID and no publications. */
    private function faculty(): Faculty
    {
        $faculty = Faculty::firstOrFail();
        $faculty->orcid_id = '0000-0002-1825-0097';
        $faculty->scopus_id = null;
        $faculty->citations = null;
        $faculty->h_index = null;
        $faculty->save();

        FacultyPublication::where('faculty_code', $faculty->faculty_code)->delete();

        return $faculty;
    }

    private function fakeOpenAlex(array $works, array $author = ['cited_by_count' => 1595, 'summary_stats' => ['h_index' => 7]]): void
    {
        Http::fake([
            'api.openalex.org/works*' => Http::response(['meta' => ['count' => count($works), 'next_cursor' => null], 'results' => $works]),
            'api.openalex.org/authors*' => Http::response($author),
        ]);
    }

    private function journalWork(): array
    {
        return [
            'id' => 'https://openalex.org/W1983391943',
            'doi' => 'https://doi.org/10.1016/j.biortech.2005.12.006',
            'display_name' => 'Microbial and plant derived biomass for removal of heavy metals',
            'publication_year' => 2007,
            'type' => 'article',
            'biblio' => ['volume' => '98', 'issue' => '12', 'first_page' => '2243', 'last_page' => '2257'],
            'authorships' => [
                ['author' => ['display_name' => 'Sarabjeet Singh Ahluwalia']],
                ['author' => ['display_name' => 'Dinesh Goyal']],
            ],
            'primary_location' => ['source' => [
                'display_name' => 'Bioresource Technology',
                'host_organization_name' => 'Elsevier BV',
                'issn_l' => '0960-8524',
            ]],
        ];
    }

    public function test_a_work_fills_every_column_the_listing_carries(): void
    {
        $faculty = $this->faculty();
        $this->fakeOpenAlex([$this->journalWork()]);

        (new SyncFacultyPublications($faculty->faculty_code))->handle();

        $row = FacultyPublication::where('faculty_code', $faculty->faculty_code)->sole();
        $this->assertSame('openalex:W1983391943', $row->external_id);
        $this->assertSame('orcid', $row->source);
        $this->assertSame('Bioresource Technology', $row->name);
        // Given name first from OpenAlex, written in the style Scopus uses.
        $this->assertSame('Ahluwalia S., Goyal D.', $row->authors);
        $this->assertSame('98', $row->volume);
        $this->assertSame('2243-2257', $row->page_no);
        $this->assertSame('0960-8524', $row->issn);
        $this->assertSame('Elsevier BV', $row->publisher);
        $this->assertSame('journal', $row->publication_type);
        // Only Scopus may claim a journal is indexed, so this stays unset.
        $this->assertNull($row->type);
        $this->assertSame('orcid', $faculty->fresh()->last_sync_source);
    }

    public function test_a_kind_the_profile_does_not_list_is_skipped(): void
    {
        $faculty = $this->faculty();
        $this->fakeOpenAlex([
            $this->journalWork(),
            ['id' => 'https://openalex.org/W2', 'type' => 'preprint', 'display_name' => 'A preprint', 'publication_year' => 2026],
            ['id' => 'https://openalex.org/W3', 'type' => 'peer-review', 'display_name' => 'A review report', 'publication_year' => 2026],
        ]);

        (new SyncFacultyPublications($faculty->faculty_code))->handle();

        $this->assertSame(1, FacultyPublication::where('faculty_code', $faculty->faculty_code)->count());
    }

    public function test_a_conference_paper_is_placed_by_its_venue_name(): void
    {
        $faculty = $this->faculty();
        $this->fakeOpenAlex([[
            'id' => 'https://openalex.org/W4',
            'type' => 'conference-paper',
            'display_name' => 'A paper read out somewhere',
            'publication_year' => 2024,
            'primary_location' => ['source' => ['display_name' => '6th International Conference on Trends in Electronics']],
        ]]);

        (new SyncFacultyPublications($faculty->faculty_code))->handle();

        $row = FacultyPublication::where('faculty_code', $faculty->faculty_code)->sole();
        $this->assertSame('conference', $row->publication_type);
        $this->assertSame('international', $row->type);
    }

    public function test_a_paper_scopus_already_supplied_is_not_imported_twice(): void
    {
        $faculty = $this->faculty();
        FacultyPublication::create([
            'faculty_code' => $faculty->faculty_code,
            'external_id' => 'scopus:2-s2.0-33846817371',
            'source' => 'scopus',
            'title' => 'The same paper, from Scopus',
            // The same DOI written the other way round, which still has to match.
            'doi_link' => 'http://dx.doi.org/10.1016/J.BIORTECH.2005.12.006',
            'publication_type' => 'journal',
            'type' => 'non-sci',
        ]);

        $this->fakeOpenAlex([$this->journalWork()]);

        (new SyncFacultyPublications($faculty->faculty_code))->handle();

        $rows = FacultyPublication::where('faculty_code', $faculty->faculty_code)->get();
        $this->assertCount(1, $rows);
        $this->assertSame('non-sci', $rows->first()->type);
    }

    public function test_rows_left_by_the_older_orcid_import_are_replaced_unless_edited(): void
    {
        $faculty = $this->faculty();
        foreach ([['orcid:111', false], ['orcid:222', true]] as [$externalId, $edited]) {
            FacultyPublication::create([
                'faculty_code' => $faculty->faculty_code,
                'external_id' => $externalId,
                'source' => 'orcid',
                'title' => 'An older import of ' . $externalId,
                'publication_type' => 'journal',
                'manually_edited' => $edited,
            ]);
        }

        $this->fakeOpenAlex([$this->journalWork()]);

        (new SyncFacultyPublications($faculty->faculty_code))->handle();

        $externalIds = FacultyPublication::where('faculty_code', $faculty->faculty_code)->pluck('external_id')->sort()->values()->all();
        $this->assertSame(['openalex:W1983391943', 'orcid:222'], $externalIds);
    }

    public function test_a_number_already_entered_is_kept_and_a_blank_one_is_filled(): void
    {
        $faculty = $this->faculty();
        $faculty->h_index = 3;
        $faculty->save();

        $this->fakeOpenAlex([$this->journalWork()]);

        (new SyncFacultyPublications($faculty->faculty_code))->handle();

        $faculty = $faculty->fresh();
        $this->assertSame(3, (int) $faculty->h_index);
        $this->assertSame(1595, (int) $faculty->citations);
    }
}
