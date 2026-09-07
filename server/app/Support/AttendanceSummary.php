<?php

namespace App\Support;

/**
 * Present/absent counts for a set of attendance records.
 *
 * percent is null rather than zero when there were no sessions at all, because
 * a scholar with no sessions has not got 0% attendance — nothing was taken.
 * Every caller has to decide how to show that, so the difference is preserved
 * here rather than flattened.
 */
final class AttendanceSummary
{
    /**
     * @param iterable<int, array<string, mixed>|object> $records
     * @return array{total:int, present:int, absent:int, percent:float|null}
     */
    public static function of(iterable $records): array
    {
        $total = 0;
        $present = 0;
        $absent = 0;

        foreach ($records as $record) {
            $status = is_array($record) ? ($record['status'] ?? null) : ($record->status ?? null);
            $total++;
            if ($status === 'present') {
                $present++;
            } elseif ($status === 'absent') {
                $absent++;
            }
        }

        return [
            'total' => $total,
            'present' => $present,
            'absent' => $absent,
            'percent' => $total > 0 ? round($present / $total * 100, 1) : null,
        ];
    }
}
