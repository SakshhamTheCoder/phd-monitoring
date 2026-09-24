<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Semester codes around today, such as 2526ODD, for a scholar to pick from.
 *
 * A port of generateReportPeriods in client-new/src/utils/semester.js, so a
 * form the server describes offers exactly the list the web page offered.
 * Kept to the same arithmetic on purpose, including its one oddity: in an
 * EVEN term the ODD term before it comes out a year early (Feb 2026 offers
 * 2425ODD, not 2526ODD). Fix both together if that is ever changed.
 *
 * Read on the institute's clock, as the browser did, so the list turns over
 * on 1 July and 1 January in India whatever the server's timezone.
 */
final class ReportPeriods
{
    /** @return string[] from $prev terms back to $next terms ahead */
    public static function around(int $next, int $prev, bool $includeCurrent = true, ?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now('Asia/Kolkata');
        $currentYear = $now->year % 100;
        $isEvenSemester = $now->month <= 6;
        $academicStartYear = $isEvenSemester ? $currentYear - 1 : $currentYear;
        $baseIndex = $includeCurrent ? 0 : ($isEvenSemester ? -1 : -2);

        $periods = [];
        for ($i = -$prev; $i <= $next; $i++) {
            $index = $baseIndex + $i;
            $semIsEven = $index % 2 !== 0 ? !$isEvenSemester : $isEvenSemester;
            $yearOffset = (int) floor($index / 2);
            $startYear = ($academicStartYear + $yearOffset + 100) % 100;
            $endYear = ($startYear + 1) % 100;
            $periods[] = sprintf('%02d%02d%s', $startYear, $endYear, $semIsEven ? 'EVEN' : 'ODD');
        }
        return $periods;
    }
}
