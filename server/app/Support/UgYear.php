<?php

namespace App\Support;

use Illuminate\Support\Carbon;

/**
 * Which year of study a UG student is in, read from their institute address.
 *
 * The institute hands out addresses carrying the admission year: `be23`,
 * `btech24`, `blas25`. A sheet of fellows often gives the address and not the
 * year, and the address is the better source anyway, since a year typed into a
 * spreadsheet in 2026 is wrong by the next session.
 *
 * The academic year turns over in July, so a `be23` student is in their first
 * year until June 2024 and their fourth from July 2026.
 */
class UgYear
{
    /** 1 to 5, or null when the address carries no admission year. */
    public static function fromEmail(?string $email, ?Carbon $asOf = null): ?int
    {
        if (!preg_match('/_[a-z]+(\d{2})@/i', (string) $email, $found)) {
            return null;
        }

        $asOf = $asOf ?: Carbon::now();
        $session = $asOf->month >= 7 ? $asOf->year : $asOf->year - 1;
        $year = $session - (2000 + (int) $found[1]) + 1;

        // A number outside the length of any programme here means the address
        // says something this cannot read, so it says nothing instead.
        return $year >= 1 && $year <= 5 ? $year : null;
    }
}
