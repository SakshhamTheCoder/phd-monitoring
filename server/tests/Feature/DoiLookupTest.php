<?php

namespace Tests\Feature;

use App\Http\Controllers\SuggestionController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/** The record a publication form is filled from, read from its DOI. */
class DoiLookupTest extends TestCase
{
    /** @param array<string, mixed> $record */
    private function rows(string $text, array $record = [], int $status = 200): array
    {
        Http::fake(['doi.org/*' => Http::response($record ?: null, $status)]);

        return (new SuggestionController())
            ->suggestDoi(Request::create('/api/suggestions/doi', 'POST', ['text' => $text]))
            ->getData(true);
    }

    private function journalArticle(int $year): array
    {
        return [
            'title' => ['A paper about something'],
            'container-title' => ['Journal of Things'],
            'author' => [
                ['family' => 'Bhatia', 'given' => 'Tarunpreet'],
                ['family' => 'Singh', 'given' => 'A'],
            ],
            'volume' => '12',
            'page' => '1-18',
            'ISSN' => ['1234-567X'],
            'publisher' => 'A Publishing House',
            'issued' => ['date-parts' => [[$year, 4, 1]]],
        ];
    }

    public function test_a_record_fills_the_form_fields(): void
    {
        $rows = $this->rows('https://doi.org/10.1016/j.things.2026.01.001', $this->journalArticle((int) now()->year));

        $this->assertCount(1, $rows);
        $this->assertSame('https://doi.org/10.1016/j.things.2026.01.001', $rows[0]['doi']);
        $this->assertSame('A paper about something', $rows[0]['title']);
        $this->assertSame('Journal of Things', $rows[0]['journal']);
        $this->assertSame('Bhatia T., Singh A.', $rows[0]['authors']);
        $this->assertSame('12', $rows[0]['volume']);
        $this->assertSame('1-18', $rows[0]['page_no']);
        $this->assertSame((string) now()->year, $rows[0]['year']);
        $this->assertSame('A Publishing House', $rows[0]['publisher']);
        // An ISSN's check digit can be X, so it is never read as a number.
        $this->assertSame('1234-567X', $rows[0]['issn']);
        $this->assertStringContainsString('A paper about something', $rows[0]['name']);
    }

    public function test_a_year_the_form_does_not_offer_is_left_out(): void
    {
        $rows = $this->rows('10.1016/j.things.2010.01.002', $this->journalArticle((int) now()->year - 9));

        $this->assertArrayNotHasKey('year', $rows[0]);
    }

    public function test_a_field_the_record_lacks_is_left_out_rather_than_sent_empty(): void
    {
        $rows = $this->rows('10.1016/j.things.2026.01.003', ['title' => ['Only a title']]);

        $this->assertSame('Only a title', $rows[0]['title']);
        $this->assertArrayNotHasKey('volume', $rows[0]);
        $this->assertArrayNotHasKey('page_no', $rows[0]);
        $this->assertArrayNotHasKey('authors', $rows[0]);
    }

    public function test_a_doi_with_no_record_still_offers_itself(): void
    {
        $rows = $this->rows('10.9999/nothing.registered.here', [], 404);

        $this->assertSame('https://doi.org/10.9999/nothing.registered.here', $rows[0]['doi']);
        $this->assertStringContainsString('no record found', $rows[0]['name']);
    }

    public function test_text_that_is_not_a_doi_is_never_looked_up(): void
    {
        Http::fake();

        $rows = (new SuggestionController())
            ->suggestDoi(Request::create('/api/suggestions/doi', 'POST', ['text' => 'a paper I wrote']))
            ->getData(true);

        $this->assertSame([], $rows);
        Http::assertNothingSent();
    }
}
