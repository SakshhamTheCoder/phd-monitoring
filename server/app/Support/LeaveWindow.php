<?php

namespace App\Support;

use App\Models\StudentLeaveForm;

/**
 * Whether an approved leave excuses a scholar on a given date.
 *
 * This is the only place that rule is written. `day_part` deliberately does not
 * narrow coverage: attendance has one session per day (lecture_id is always 0),
 * so a half-day leave excuses the whole day and only costs less against the
 * quota. See LeaveBalance for the cost.
 */
final class LeaveWindow
{
    public static function covers(StudentLeaveForm $leave, string $date): bool
    {
        if ($leave->status !== 'approved') {
            return false;
        }
        if (!$leave->from_date || !$leave->to_date) {
            return false;
        }

        $day = substr($date, 0, 10);

        return $leave->from_date->toDateString() <= $day
            && $leave->to_date->toDateString() >= $day;
    }

    /**
     * Every scholar in $rollNos who is excused on $date.
     *
     * @param array<int,int> $rollNos
     * @return array<int, array{type:string, day_part:string, leave_id:int}>
     */
    public static function forDate(array $rollNos, string $date): array
    {
        if ($rollNos === []) {
            return [];
        }

        $day = substr($date, 0, 10);

        // A NULL from_date/to_date makes whereDate() evaluate to NULL, which
        // SQL's WHERE treats as false, so such rows are excluded here without
        // an explicit guard — the same outcome covers() reaches with its
        // `!$leave->from_date || !$leave->to_date` check above.
        $leaves = StudentLeaveForm::approved()
            ->whereIn('student_id', $rollNos)
            ->whereDate('from_date', '<=', $day)
            ->whereDate('to_date', '>=', $day)
            ->get();

        $out = [];
        foreach ($leaves as $leave) {
            // First approved leave wins; overlapping approvals are equivalent
            // for the only question asked here, which is "excused or not".
            $out[$leave->student_id] ??= [
                'type' => $leave->leave_type,
                'day_part' => $leave->day_part,
                'leave_id' => $leave->id,
            ];
        }

        return $out;
    }
}
