<?php

namespace Tests\Unit;

use App\Http\Controllers\PresentationController;
use PHPUnit\Framework\TestCase;

/**
 * The progress sheet in the office's own hand.
 *
 * It names the period as a month range and a calendar year, in as many
 * spellings as there are typists, and the portal wants a semester code. Read
 * strictly, none of the institute's 1,798 rows was importable.
 */
class ProgressSheetWordingTest extends TestCase
{
    /** @return array<int, array{0: string, 1: string}> */
    public static function periods(): array
    {
        return [
            ['2425ODD', '2425ODD'],
            ['2526ODDSEM', '2526ODD'],
            ['2425 EVEN', '2425EVEN'],
            // July to December is the odd semester of the year it starts.
            ['July-Dec 2025', '2526ODD'],
            ['July - December 2024', '2425ODD'],
            ['Sept-Dec 2022', '2223ODD'],
            ['July 2022 to Dec. 2022', '2223ODD'],
            // January to June is the even semester of the year before it.
            ['jan-june 2025', '2425EVEN'],
            ['Jan Jun 2020', '1920EVEN'],
            ['January 2023 to June 2023', '2223EVEN'],
            ['July to Dec 2025,', '2526ODD'],
            // Nothing a period can be read out of.
            ['NA', ''],
            ['-', ''],
            ['Course work', ''],
            ['', ''],
        ];
    }

    /** @dataProvider periods */
    public function test_a_period_is_read_however_the_office_writes_it(string $written, string $expected): void
    {
        $this->assertSame($expected, PresentationController::semesterCode($written));
    }

    /** @return array<int, array{0: string, 1: string}> */
    public static function dates(): array
    {
        return [
            ['22-09-2020', '2020-09-22'],
            ['18-03-2025', '2025-03-18'],
            ['2025-03-18', '2025-03-18'],
            // Month and year only: the first of that month.
            ['Sep-25', '2025-09-01'],
            ['Apr-26', '2026-04-01'],
            ['09.2025', '2025-09-01'],
            // A word where a date belongs leaves it empty for a coordinator.
            ['Absent', ''],
            ['Maternity Leave', ''],
            ['NA', ''],
            ['-', ''],
            ['', ''],
        ];
    }

    /** @dataProvider dates */
    public function test_a_date_is_read_or_left_for_somebody_to_fill(string $written, string $expected): void
    {
        $this->assertSame($expected, PresentationController::progressDate($written));
    }

    /**
     * The sheet writes a registration number once and leaves the rows under it
     * blank, which is a merged cell to a person and nothing to a parser. Two
     * thirds of the institute's sheet is those rows.
     */
    public function test_a_registration_number_carries_down_the_rows_under_it(): void
    {
        $rows = [
            ['Registration Number' => '902000001', 'Progress for AY' => 'July-Dec 2024', 'Total Progress %' => '20', '_rowNumber' => 2],
            ['Registration Number' => '', 'Progress for AY' => 'jan-june 2025', 'Total Progress %' => '35', '_rowNumber' => 3],
            ['Registration Number' => '902000002', 'Progress for AY' => 'July-Dec 2025', 'Total Progress %' => '10', '_rowNumber' => 4],
        ];

        $read = PresentationController::progressRows($rows);

        $this->assertSame(['902000001', '902000001', '902000002'], array_column($read, 'roll_no'));
        $this->assertSame(['2425ODD', '2425EVEN', '2526ODD'], array_column($read, 'semester'));
    }
}
