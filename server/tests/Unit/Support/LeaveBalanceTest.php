<?php

namespace Tests\Unit\Support;

use App\Models\LeaveSetting;
use App\Models\StudentLeaveForm;
use App\Support\LeaveBalance;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class LeaveBalanceTest extends TestCase
{
    use DatabaseTransactions;

    private function setYearStart(int $month): void
    {
        LeaveSetting::updateOrCreate(['key' => 'year_start_month'], ['value' => $month]);
    }

    public function test_a_date_after_the_start_month_belongs_to_the_year_that_just_began(): void
    {
        $this->setYearStart(7);

        $this->assertSame(
            ['start' => '2026-07-01', 'end' => '2027-06-30'],
            LeaveBalance::yearWindow('2026-09-14')
        );
    }

    public function test_a_date_before_the_start_month_belongs_to_the_year_that_is_still_running(): void
    {
        $this->setYearStart(7);

        $this->assertSame(
            ['start' => '2025-07-01', 'end' => '2026-06-30'],
            LeaveBalance::yearWindow('2026-03-02')
        );
    }

    public function test_the_start_month_boundary_opens_a_new_year(): void
    {
        $this->setYearStart(7);

        $this->assertSame('2026-07-01', LeaveBalance::yearWindow('2026-07-01')['start']);
        $this->assertSame('2025-07-01', LeaveBalance::yearWindow('2026-06-30')['start']);
    }

    public function test_a_calendar_year_start_is_supported(): void
    {
        $this->setYearStart(1);

        $this->assertSame(
            ['start' => '2026-01-01', 'end' => '2026-12-31'],
            LeaveBalance::yearWindow('2026-09-14')
        );
    }

    public function test_a_full_day_range_costs_its_inclusive_day_count(): void
    {
        $leave = new StudentLeaveForm([
            'from_date' => '2026-09-14', 'to_date' => '2026-09-18', 'day_part' => 'full',
        ]);

        $this->assertSame(5.0, LeaveBalance::daysFor($leave));
    }

    public function test_a_single_full_day_costs_one(): void
    {
        $leave = new StudentLeaveForm([
            'from_date' => '2026-09-14', 'to_date' => '2026-09-14', 'day_part' => 'full',
        ]);

        $this->assertSame(1.0, LeaveBalance::daysFor($leave));
    }

    public function test_a_half_day_costs_half_regardless_of_range(): void
    {
        $single = new StudentLeaveForm([
            'from_date' => '2026-09-14', 'to_date' => '2026-09-14', 'day_part' => 'first_half',
        ]);
        $this->assertSame(0.5, LeaveBalance::daysFor($single));

        // Unreachable through the UI, which offers day_part only on a single
        // day, but the rule must still be defined for an API caller.
        $spanning = new StudentLeaveForm([
            'from_date' => '2026-09-14', 'to_date' => '2026-09-18', 'day_part' => 'second_half',
        ]);
        $this->assertSame(0.5, LeaveBalance::daysFor($spanning));
    }

    public function test_an_unapproved_absence_is_charged_to_casual(): void
    {
        $this->setYearStart(7);
        $rollNo = (int) \App\Models\Student::query()->value('roll_no');
        $this->assertNotNull($rollNo, 'the suite needs at least one student');

        \App\Models\Attendance::updateOrCreate(
            ['roll_no' => $rollNo, 'date' => '2026-09-15', 'lecture_id' => 0],
            ['status' => 'absent']
        );

        $balance = LeaveBalance::for($rollNo, '2026-09-14');

        $this->assertSame(1.0, $balance['casual']['used']);
        $this->assertSame(0.0, $balance['academic']['used']);
    }

    public function test_an_absence_covered_by_approved_leave_is_charged_only_once(): void
    {
        $this->setYearStart(7);
        $rollNo = (int) \App\Models\Student::query()->value('roll_no');

        StudentLeaveForm::create([
            'student_id' => $rollNo,
            'leave_type' => 'casual',
            'from_date' => '2026-09-15',
            'to_date' => '2026-09-15',
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
        ]);
        \App\Models\Attendance::updateOrCreate(
            ['roll_no' => $rollNo, 'date' => '2026-09-15', 'lecture_id' => 0],
            ['status' => 'absent']
        );

        // 1.0 for the leave itself, and nothing for the absence it covers.
        $this->assertSame(1.0, LeaveBalance::for($rollNo, '2026-09-14')['casual']['used']);
    }

    public function test_remaining_goes_negative_rather_than_clamping(): void
    {
        $this->setYearStart(7);
        LeaveSetting::updateOrCreate(['key' => 'casual_quota'], ['value' => 1]);
        $rollNo = (int) \App\Models\Student::query()->value('roll_no');

        StudentLeaveForm::create([
            'student_id' => $rollNo,
            'leave_type' => 'casual',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-16',
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
        ]);

        $this->assertSame(-2.0, LeaveBalance::for($rollNo, '2026-09-14')['casual']['remaining']);
    }

    public function test_an_absence_covered_by_a_leave_that_started_before_the_window_is_not_double_charged(): void
    {
        $this->setYearStart(7);
        $rollNo = (int) \App\Models\Student::query()->value('roll_no');

        StudentLeaveForm::create([
            'student_id' => $rollNo,
            'leave_type' => 'casual',
            'from_date' => '2026-06-28',
            'to_date' => '2026-07-03',
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
        ]);
        \App\Models\Attendance::updateOrCreate(
            ['roll_no' => $rollNo, 'date' => '2026-07-02', 'lecture_id' => 0],
            ['status' => 'absent']
        );

        // The leave is charged wholly to the previous window (it started
        // there), and the absence it covers must not be counted as
        // unapproved here even though the leave itself is outside $leaves
        // for this window.
        $this->assertSame(0.0, LeaveBalance::for($rollNo, '2026-09-14')['casual']['used']);
    }

    public function test_a_boundary_spanning_leave_is_still_charged_to_the_window_it_started_in(): void
    {
        $this->setYearStart(7);
        $rollNo = (int) \App\Models\Student::query()->value('roll_no');

        StudentLeaveForm::create([
            'student_id' => $rollNo,
            'leave_type' => 'casual',
            'from_date' => '2026-06-28',
            'to_date' => '2026-07-03',
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
        ]);

        // 28 Jun - 3 Jul inclusive is 6 days, charged to the window that
        // contains its start date (2025-07-01 .. 2026-06-30).
        $this->assertSame(6.0, LeaveBalance::for($rollNo, '2026-06-29')['casual']['used']);
    }
}
