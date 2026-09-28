<?php

namespace Tests\Unit;

use App\Support\SheetDate;
use PHPUnit\Framework\TestCase;

/**
 * Every date shape the institute's sheets have actually held, kept here because
 * each one cost a real row when it reached the database as text.
 */
class SheetDatesAreReadHoweverTheyWereTypedTest extends TestCase
{
    public static function dates(): array
    {
        return [
            'day first with dashes' => ['10-01-2024', '2024-01-10'],
            'day first with slashes' => ['27/06/2023', '2023-06-27'],
            'day first with dots' => ['18.03.2025', '2025-03-18'],
            'short month' => ['23-Feb-2026', '2026-02-23'],
            'dotted short month' => ['18.Mar.2025', '2025-03-18'],
            'september spelt Sept' => ['11-Sept-2025', '2025-09-11'],
            'month written out' => ['17-July-2026', '2026-07-17'],
            'already stored shape' => ['2024-01-10', '2024-01-10'],
            'month and year only' => ['Sep-25', '2025-09-01'],
            'short month with dots' => ['24.Feb.2025', '2025-02-24'],
            'stray space beside the dash' => ['11- Mar-2026', '2026-03-11'],
            'spaces either side' => ['22 - July - 2026', '2026-07-22'],
        ];
    }

    /** @dataProvider dates */
    public function test_a_date_is_read_however_it_was_typed(string $written, string $expected): void
    {
        $this->assertSame($expected, SheetDate::parse($written));
    }

    /** A cell holding a word is no date, and says so rather than guessing one. */
    public function test_a_cell_that_is_not_a_date_reads_as_nothing(): void
    {
        foreach (['', '  ', 'awaited', 'NA', '#N/A', 'not yet'] as $written) {
            $this->assertSame('', SheetDate::parse($written), $written);
        }
    }
}
