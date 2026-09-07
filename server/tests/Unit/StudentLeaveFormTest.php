<?php

namespace Tests\Unit;

use App\Models\Student;
use App\Models\StudentLeaveForm;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class StudentLeaveFormTest extends TestCase
{
    use DatabaseTransactions;

    public function test_a_full_day_leave_is_not_a_half_day(): void
    {
        $leave = new StudentLeaveForm(['day_part' => 'full']);
        $this->assertFalse($leave->isHalfDay());
    }

    public function test_either_half_counts_as_a_half_day(): void
    {
        $this->assertTrue((new StudentLeaveForm(['day_part' => 'first_half']))->isHalfDay());
        $this->assertTrue((new StudentLeaveForm(['day_part' => 'second_half']))->isHalfDay());
    }

    public function test_the_approved_scope_excludes_pending_and_rejected(): void
    {
        $student = Student::query()->firstOrFail();

        $approved = StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
        ]);
        $pending = StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
        ]);
        $rejected = StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'status' => 'rejected',
        ]);

        $ids = StudentLeaveForm::approved()->pluck('id');

        $this->assertTrue($ids->contains($approved->id));
        $this->assertFalse($ids->contains($pending->id));
        $this->assertFalse($ids->contains($rejected->id));
    }
}
