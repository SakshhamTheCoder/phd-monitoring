<?php

namespace Tests\Unit;

use App\Models\Student;
use Tests\TestCase;

class StudentIrbCompletionTest extends TestCase
{
    public function test_a_student_with_no_irb_record_has_not_completed_it(): void
    {
        $this->assertFalse(Student::irbStatusMeansComplete(null));
    }

    public function test_a_draft_or_pending_irb_is_not_complete(): void
    {
        $this->assertFalse(Student::irbStatusMeansComplete('draft'));
        $this->assertFalse(Student::irbStatusMeansComplete('pending'));
    }

    public function test_a_rejected_irb_is_not_complete(): void
    {
        $this->assertFalse(Student::irbStatusMeansComplete('rejected'));
    }

    public function test_an_approved_irb_is_complete(): void
    {
        $this->assertTrue(Student::irbStatusMeansComplete('approved'));
    }

    public function test_the_decision_is_case_insensitive_and_ignores_stray_whitespace(): void
    {
        $this->assertTrue(Student::irbStatusMeansComplete(' Approved '));
    }
}
