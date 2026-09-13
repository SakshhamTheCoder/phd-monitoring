<?php

namespace Tests\Feature;

use App\Http\Controllers\SupervisorAllocationController;
use App\Models\Role;
use App\Models\SupervisorAllocation;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Tests\TestCase;

/**
 * A student's form list was filtered by "has this form reached my step yet",
 * which asks for the caller's position in the form's chain. An admin is never
 * in a chain, so the search found nothing and the list came back empty for
 * every scholar.
 */
class AdminReadsStudentFormsTest extends TestCase
{
    use DatabaseTransactions;

    public function test_an_admin_sees_a_students_form(): void
    {
        $student = Student::query()->first();

        if (!$student) {
            $this->markTestSkipped('No student in this database.');
        }

        SupervisorAllocation::create([
            'student_id' => $student->roll_no,
            'status' => 'approved',
            'completion' => 'complete',
            'stage' => 'complete',
            'steps' => ['student', 'phd_coordinator', 'hod', 'complete'],
            'current_step' => 3,
            'maximum_step' => 3,
        ]);

        $admin = User::query()->first();
        $admin->current_role_id = Role::where('role', 'admin')->value('id');
        $admin->save();
        Auth::login($admin->fresh());

        $response = app(SupervisorAllocationController::class)
            ->listForm(Request::create('/', 'GET'), $student->roll_no);

        $this->assertSame(200, $response->status());
        $this->assertNotEmpty(
            json_decode($response->getContent(), true),
            'An admin should see the forms of a scholar they are allowed to read.'
        );
    }
}
