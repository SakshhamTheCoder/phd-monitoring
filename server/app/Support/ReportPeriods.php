<?php

namespace App\Support;

use Carbon\Carbon;

/**
 * Semester codes around today, such as 2526ODD, for a scholar to pick from.
 *
 * The same list generateReportPeriods (client-new/src/utils/semester.js) gives.
 * An academic year runs July to June and is odd until December. Terms are
 * counted in a row (year * 2, plus one for the even term), so stepping back
 * from an even term lands on the odd term of the same academic year.
 *
 * Read on the institute's clock, as the browser does, so the list turns over
 * on 1 July and 1 January in India whatever the server's timezone.
 */
final class ReportPeriods
{
    /** @return string[] from $prev terms back to $next terms ahead */
    public static function around(int $next, int $prev, bool $includeCurrent = true, ?Carbon $now = null): array
    {
        $now = $now ?? Carbon::now('Asia/Kolkata');
        $isEvenSemester = $now->month <= 6;
        $academicStartYear = ($now->year % 100) - ($isEvenSemester ? 1 : 0);
        $currentTerm = $academicStartYear * 2 + ($isEvenSemester ? 1 : 0);
        $baseIndex = $includeCurrent ? 0 : ($isEvenSemester ? -1 : -2);

        $periods = [];
        for ($i = -$prev; $i <= $next; $i++) {
            $term = $currentTerm + $baseIndex + $i;
            $startYear = (((int) floor($term / 2)) % 100 + 100) % 100;
            $even = (($term % 2) + 2) % 2 === 1;
            $periods[] = sprintf('%02d%02d%s', $startYear, ($startYear + 1) % 100, $even ? 'EVEN' : 'ODD');
        }
        return $periods;
    }
}
