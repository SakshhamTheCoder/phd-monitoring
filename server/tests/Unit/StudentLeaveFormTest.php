<?php

namespace Tests\Unit;

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
        $sql = StudentLeaveForm::approved()->toSql();
        $this->assertStringContainsString('status', $sql);
        $this->assertSame(['approved'], StudentLeaveForm::approved()->getBindings());
    }
}
