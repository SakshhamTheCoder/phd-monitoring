<?php

namespace Tests\Unit\Support;

use App\Models\Student;
use App\Models\StudentLeaveForm;
use App\Support\LeaveWindow;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class LeaveWindowTest extends TestCase
{
    use DatabaseTransactions;

    private function leave(array $attributes = []): StudentLeaveForm
    {
        return new StudentLeaveForm(array_merge([
            'status' => 'approved',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-18',
            'day_part' => 'full',
            'leave_type' => 'casual',
        ], $attributes));
    }

    public function test_a_date_inside_the_range_is_covered(): void
    {
        $this->assertTrue(LeaveWindow::covers($this->leave(), '2026-09-16'));
    }

    public function test_both_boundaries_are_inclusive(): void
    {
        $this->assertTrue(LeaveWindow::covers($this->leave(), '2026-09-14'));
        $this->assertTrue(LeaveWindow::covers($this->leave(), '2026-09-18'));
    }

    public function test_a_date_outside_the_range_is_not_covered(): void
    {
        $this->assertFalse(LeaveWindow::covers($this->leave(), '2026-09-13'));
        $this->assertFalse(LeaveWindow::covers($this->leave(), '2026-09-19'));
    }

    public function test_only_an_approved_leave_covers_anything(): void
    {
        foreach (['pending', 'rejected', 'draft'] as $status) {
            $this->assertFalse(
                LeaveWindow::covers($this->leave(['status' => $status]), '2026-09-16'),
                "status {$status} must not excuse a day"
            );
        }
    }

    public function test_a_half_day_still_covers_the_whole_day(): void
    {
        $this->assertTrue(LeaveWindow::covers($this->leave(['day_part' => 'first_half']), '2026-09-16'));
        $this->assertTrue(LeaveWindow::covers($this->leave(['day_part' => 'second_half']), '2026-09-16'));
    }

    public function test_a_single_day_leave_covers_exactly_that_day(): void
    {
        $one = $this->leave(['from_date' => '2026-09-14', 'to_date' => '2026-09-14']);
        $this->assertTrue(LeaveWindow::covers($one, '2026-09-14'));
        $this->assertFalse(LeaveWindow::covers($one, '2026-09-15'));
    }

    public function test_for_date_returns_the_full_shape_for_an_approved_leave(): void
    {
        $student = Student::query()->firstOrFail();

        $approved = StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'stage' => 'complete',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-18',
            'day_part' => 'first_half',
            'leave_type' => 'academic',
        ]);

        $result = LeaveWindow::forDate([$student->roll_no], '2026-09-16');

        $this->assertSame([
            $student->roll_no => [
                'type' => 'academic',
                'day_part' => 'first_half',
                'leave_id' => $approved->id,
            ],
        ], $result);
    }

    public function test_for_date_excludes_a_pending_leave(): void
    {
        $student = Student::query()->firstOrFail();
        $other = Student::query()->where('roll_no', '!=', $student->roll_no)->firstOrFail();

        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'stage' => 'complete',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-18',
        ]);
        StudentLeaveForm::create([
            'student_id' => $other->roll_no,
            'status' => 'pending',
            'stage' => 'complete',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-18',
        ]);

        $result = LeaveWindow::forDate([$student->roll_no, $other->roll_no], '2026-09-16');

        $this->assertArrayHasKey($student->roll_no, $result);
        $this->assertArrayNotHasKey($other->roll_no, $result);
    }

    public function test_for_date_excludes_a_date_just_outside_the_range(): void
    {
        $student = Student::query()->firstOrFail();

        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'stage' => 'complete',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-18',
        ]);

        $result = LeaveWindow::forDate([$student->roll_no], '2026-09-19');

        $this->assertArrayNotHasKey($student->roll_no, $result);
    }

    public function test_for_date_with_no_roll_nos_returns_empty_array(): void
    {
        $this->assertSame([], LeaveWindow::forDate([], '2026-09-16'));
    }

    public function test_for_date_keeps_the_first_of_two_overlapping_approved_leaves(): void
    {
        $student = Student::query()->firstOrFail();

        $first = StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'stage' => 'complete',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-18',
        ]);
        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'stage' => 'complete',
            'from_date' => '2026-09-15',
            'to_date' => '2026-09-20',
        ]);

        $result = LeaveWindow::forDate([$student->roll_no], '2026-09-16');

        $this->assertCount(1, $result);
        $this->assertSame($first->id, $result[$student->roll_no]['leave_id']);
    }

    public function test_for_date_excludes_a_leave_with_null_date_range(): void
    {
        $student = Student::query()->firstOrFail();

        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'stage' => 'complete',
            'from_date' => null,
            'to_date' => null,
        ]);

        $result = LeaveWindow::forDate([$student->roll_no], '2026-09-16');

        $this->assertArrayNotHasKey($student->roll_no, $result);
    }
}
