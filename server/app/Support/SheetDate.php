<?php

namespace App\Support;

/**
 * A date as the institute's sheets write it, read into the one shape MySQL
 * takes.
 *
 * The office's files carry 23-Feb-2026, 10-01-2024, 27/06/2023 and 2024-01-10
 * in the same column, because a spreadsheet shows a date however the machine
 * that typed it was set. Laravel's `date` rule accepts all of them, so they
 * passed validation and then reached the database as text, where a scholar's
 * whole row was refused with "Incorrect date value".
 *
 * Day comes before month, which is how the institute writes dates: 10-01-2024
 * is the tenth of January.
 */
class SheetDate
{
    /** Y-m-d, or '' when the cell holds no date. */
    public static function parse(string $value): string
    {
        $value = trim($value);
        if ($value === '' || !preg_match('/\d/', $value)) {
            return '';
        }

        // The sheet writes September as Sept in places, which is neither the
        // three letter month PHP reads nor the whole word.
        $value = preg_replace('/\bSept\b/i', 'Sep', $value);

        // A cell typed as "11- Mar-2026" is one date with a stray space in it,
        // not a shape of its own, so a space beside a separator goes.
        $value = preg_replace('/\s*([-\/.])\s*/', '$1', $value);

        // The j and n formats are the same shapes with the leading zero left
        // off, which is what a spreadsheet shows when the cell is text.
        foreach ([
            'd-m-Y', 'd/m/Y', 'd.m.Y', 'j-n-Y', 'j/n/Y', 'j.n.Y',
            'd-m-y', 'j-n-y',
            'd-M-Y', 'd/M/Y', 'd.M.Y', 'd M Y', 'j-M-Y', 'j/M/Y', 'j.M.Y', 'j M Y',
            'd-M-y', 'j-M-y',
            'd-F-Y', 'd/F/Y', 'd.F.Y', 'd F Y', 'j-F-Y', 'j/F/Y', 'j.F.Y', 'j F Y',
            'Y-m-d', 'Y/m/d',
        ] as $format) {
            $date = \DateTime::createFromFormat('!' . $format, $value);
            if ($date && $date->format($format) === $value) {
                return $date->format('Y-m-d');
            }
        }

        // "Sep-25", "Apr-26", "09.2025": the month is known, the day is not.
        foreach (['M-y', 'M-Y', 'F-Y', 'F-y', 'm-Y', 'm.Y', 'm/Y', 'M y', 'F y'] as $format) {
            $date = \DateTime::createFromFormat('!' . $format, $value);
            if ($date && $date->format($format) === $value) {
                return $date->format('Y-m-01');
            }
        }

        return '';
    }
}
