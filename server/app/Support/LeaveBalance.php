<?php

namespace App\Support;

use App\Models\Attendance;
use App\Models\LeaveSetting;
use App\Models\StudentLeaveForm;
use Carbon\CarbonImmutable;

/**
 * How much leave a scholar has used and has left, for the quota year that
 * contains a given date.
 *
 * Two rules live here and nowhere else:
 *  - a half-day costs 0.5 however long its range (see daysFor);
 *  - casual usage includes absences nobody approved, so being marked absent
 *    spends casual balance exactly as taking casual leave does.
 */
final class LeaveBalance
{
    /** @return array{start:string, end:string} */
    public static function yearWindow(string $onDate): array
    {
        $startMonth = LeaveSetting::value('year_start_month');
        $date = CarbonImmutable::parse(substr($onDate, 0, 10));

        $startYear = $date->month >= $startMonth ? $date->year : $date->year - 1;
        $start = CarbonImmutable::create($startYear, $startMonth, 1);

        return [
            'start' => $start->toDateString(),
            'end' => $start->addYear()->subDay()->toDateString(),
        ];
    }

    /** A half-day costs 0.5 in total, not per day. */
    public static function daysFor(StudentLeaveForm $leave): float
    {
        if ($leave->isHalfDay()) {
            return 0.5;
        }
        if (!$leave->from_date || !$leave->to_date) {
            return 0.0;
        }

        return (float) ($leave->from_date->diffInDays($leave->to_date) + 1);
    }

    /**
     * @return array{
     *   academic: array{quota:float, used:float, remaining:float},
     *   casual: array{quota:float, used:float, remaining:float},
     *   window: array{start:string, end:string}
     * }
     */
    public static function for(int $rollNo, string $onDate): array
    {
        $window = self::yearWindow($onDate);

        $leaves = StudentLeaveForm::approved()
            ->where('student_id', $rollNo)
            ->whereBetween('from_date', [$window['start'], $window['end']])
            ->get();

        $used = ['academic' => 0.0, 'casual' => 0.0];
        foreach ($leaves as $leave) {
            $used[$leave->leave_type] += self::daysFor($leave);
        }

        // Charging follows the leave's start date (above, via $leaves), so a
        // leave that starts before this window but spans into it is charged
        // wholly to the earlier window. Coverage, by contrast, must follow the
        // actual days the leave excuses, so it needs every approved leave that
        // overlaps this window at all -- not just those starting inside it --
        // or a boundary-spanning leave's days here would be wrongly counted as
        // unapproved absences on top of being charged to the earlier window.
        $overlapping = StudentLeaveForm::approved()
            ->where('student_id', $rollNo)
            ->whereDate('to_date', '>=', $window['start'])
            ->whereDate('from_date', '<=', $window['end'])
            ->get();

        $used['casual'] += self::unapprovedAbsences($rollNo, $window, $overlapping);

        $quota = [
            'academic' => (float) LeaveSetting::value('academic_quota'),
            'casual' => (float) LeaveSetting::value('casual_quota'),
        ];

        $out = ['window' => $window];
        foreach (['academic', 'casual'] as $type) {
            $out[$type] = [
                'quota' => $quota[$type],
                'used' => $used[$type],
                // Deliberately not clamped: the UI shows an overage.
                'remaining' => $quota[$type] - $used[$type],
            ];
        }

        return $out;
    }

    /**
     * Absent days in the window that no approved leave covers. A day covered by
     * leave is charged to the leave and must not be charged again here.
     *
     * @param array{start:string, end:string} $window
     * @param iterable<int, StudentLeaveForm> $leaves
     */
    private static function unapprovedAbsences(int $rollNo, array $window, iterable $leaves): float
    {
        $dates = Attendance::where('roll_no', $rollNo)
            ->where('status', 'absent')
            ->whereBetween('date', [$window['start'], $window['end']])
            ->pluck('date')
            ->map(fn ($d) => $d instanceof \DateTimeInterface ? $d->format('Y-m-d') : substr((string) $d, 0, 10))
            ->unique();

        $count = 0.0;
        foreach ($dates as $date) {
            foreach ($leaves as $leave) {
                if (LeaveWindow::covers($leave, $date)) {
                    continue 2;
                }
            }
            $count += 1.0;
        }

        return $count;
    }
}
