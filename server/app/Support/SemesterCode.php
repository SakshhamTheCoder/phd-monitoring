<?php

namespace App\Support;

/**
 * The period a sheet names, as the semester code the portal stores.
 *
 * The office writes a period in about as many spellings as there are rows:
 * "July-Dec 2025", "jan-june 2025", "2425ODDSEM", "2425EVESEM". July to
 * December is the odd semester of the academic year that starts then; January
 * to June is the even semester of the year that started the July before.
 *
 * Read by the progress import, which gets month ranges, and by the coursework
 * import, which gets the institute's own tokens.
 */
class SemesterCode
{
    /** A code like 2425ODD, or '' when the value names no period. */
    public static function of(string $value): string
    {
        // A trailing comma or full stop is punctuation, not part of the period.
        $value = trim($value, " \t\r\n .,;:-");
        if ($value === '') {
            return '';
        }

        // 2425ODDSEM, 2425EVESEM, 2425EVEN: the institute's own token, whose
        // even semester is written EVE as often as EVEN.
        if (preg_match('/^(\d{2})(\d{2})\s*(ODD|EVEN|EVE)/i', $value, $matches)) {
            $half = strtoupper($matches[3]) === 'ODD' ? 'ODD' : 'EVEN';
            return $matches[1] . $matches[2] . $half;
        }

        // "January 2023 to June 2023" and "July 2022 to Dec. 2022" name a year
        // twice; the one that decides the semester is the one beside the first
        // month, so the first month and the first year are what is read.
        if (!preg_match('/([a-z]+)\D*?((?:19|20)\d{2}|\d{2})(?!\d)/i', $value, $matches)) {
            return '';
        }

        $month = strtolower(substr($matches[1], 0, 3));
        $year = (int) $matches[2];
        $year += $year < 100 ? 2000 : 0;

        if (in_array($month, ['jan', 'feb', 'mar', 'apr', 'may', 'jun'], true)) {
            return sprintf('%02d%02dEVEN', ($year - 1) % 100, $year % 100);
        }

        if (in_array($month, ['jul', 'aug', 'sep', 'oct', 'nov', 'dec'], true)) {
            return sprintf('%02d%02dODD', $year % 100, ($year + 1) % 100);
        }

        return '';
    }
}
