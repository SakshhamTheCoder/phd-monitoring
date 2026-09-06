<?php

namespace App\Support;

/**
 * A project's length, as the portal states it.
 *
 * Duration is stored as two integers so it can be filtered and summed, but it
 * is spoken as one phrase. The phrase never carries a zero component: a
 * three-year project is "3 Years", not "3 Years 0 Months".
 */
final class ProjectDuration
{
    public const MIN_YEARS = 1;
    public const MAX_YEARS = 5;
    public const MAX_MONTHS = 11;

    /** The em dash the portal uses everywhere for "nothing recorded". */
    public const EMPTY = '—';

    /** @return array<int, int> */
    public static function yearOptions(): array
    {
        return range(self::MIN_YEARS, self::MAX_YEARS);
    }

    public static function totalMonths(?int $years, ?int $months): int
    {
        return max(0, (int) $years) * 12 + max(0, (int) $months);
    }

    public static function format(?int $years, ?int $months): string
    {
        $y = max(0, (int) $years);
        $m = max(0, (int) $months);

        $parts = [];
        if ($y > 0) {
            $parts[] = $y . ' ' . ($y === 1 ? 'Year' : 'Years');
        }
        if ($m > 0) {
            $parts[] = $m . ' ' . ($m === 1 ? 'Month' : 'Months');
        }

        return $parts === [] ? self::EMPTY : implode(' ', $parts);
    }
}
