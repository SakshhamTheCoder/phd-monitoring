<?php

namespace Tests\Unit\Support;

use App\Models\StudentLeaveForm;
use App\Support\LeaveWindow;
use Tests\TestCase;

class LeaveWindowTest extends TestCase
{
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
}
