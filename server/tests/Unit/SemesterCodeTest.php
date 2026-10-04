<?php

namespace Tests\Unit;

use App\Support\SemesterCode;
use PHPUnit\Framework\TestCase;

/**
 * The period a sheet names, read as a semester code.
 *
 * The office writes a range, and a range names two months. Which of them
 * decides the semester is the question these pin.
 */
class SemesterCodeTest extends TestCase
{
    /** @dataProvider periods */
    public function test_a_period_reads_as_its_code(string $written, string $code): void
    {
        $this->assertSame($code, SemesterCode::of($written), $written);
    }

    public static function periods(): array
    {
        return [
            'the institute\'s own token' => ['2425ODDSEM', '2425ODD'],
            'its even half, written short' => ['2425EVESEM', '2425EVEN'],

            'the odd semester' => ['July-Dec 2025', '2526ODD'],
            'the even semester' => ['jan-june 2025', '2425EVEN'],
            'named in full' => ['January 2020 - June 2020', '1920EVEN'],

            // A range that starts in the first half of the year and ends in the
            // last quarter is the odd semester, written from a month early.
            'june to december' => ['June 2025-December 2025', '2526ODD'],
            'june to december, short' => ['june-dec 2024', '2425ODD'],
            'december with a letter missing' => ['june-dc 2025', '2526ODD'],

            // A calendar year written loosely. These sit between two odd
            // semesters in the sheet, so what they name is the even one.
            'january to december' => ['Jan 2023-December 2023', '2223EVEN'],
            'april to october' => ['April-October 2024', '2324EVEN'],

            // July is the other way about: it ends the even semester as often as
            // it begins the odd one, so the month the range starts in decides.
            'january to july' => ['Jan 2026-July 2026', '2526EVEN'],
            'january to june' => ['Jan to June 2026', '2526EVEN'],

            // Both halves of the odd semester, which the office sometimes
            // writes as two quarters. Neither is the even semester.
            'the first quarter of it' => ['July to Sept 2023', '2324ODD'],
            'the second' => ['Oct ot Dec 2023', '2324ODD'],

            'two periods in one cell' => ['jul-dec 2021, jan-june 2022', '2122ODD'],
            'nothing at all' => ['', ''],
            'a word that names no period' => ['Absent', ''],
        ];
    }
}
