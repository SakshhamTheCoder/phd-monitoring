<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Every AdminFormController endpoint used to have no authorization check at
 * all: the only gate was a localStorage flag the browser sent, which any
 * authenticated user could set. That made every scholar's form state
 * (stage, locks, availability, instance count) writable by anyone signed in,
 * the widest hole on this branch. It is fixed with can_manage_form_levels,
 * admin only, via the AuthorizesCapability trait.
 */
class AdminFormAuthorizationTest extends TestCase
{
    use DatabaseTransactions;

    private function actingAsRole(string $role): User
    {
        $user = User::query()->whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        return $user->fresh();
    }

    public function test_a_student_is_refused_the_admin_form_console(): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAsRole('student');

        $this->getJson("/api/admin/forms/student/{$student->roll_no}")
            ->assertStatus(403);
    }

    public function test_an_admin_may_open_the_admin_form_console(): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAsRole('admin');

        $this->getJson("/api/admin/forms/student/{$student->roll_no}")
            ->assertStatus(200);
    }

    /**
     * The same gate on a second endpoint, so a fix scoped to one route in the
     * controller (as the original bug fix for D19 was) cannot hide a sibling
     * left open.
     */
    public function test_a_faculty_member_cannot_disable_a_students_form(): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAsRole('faculty');

        $this->postJson('/api/admin/forms/disable', [
            'student_id' => $student->roll_no,
            'form_type' => 'irb-constitution',
        ])->assertStatus(403);
    }

    public function test_an_admin_may_reach_past_the_gate_to_disable_a_students_form(): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAsRole('admin');

        $response = $this->postJson('/api/admin/forms/disable', [
            'student_id' => $student->roll_no,
            'form_type' => 'irb-constitution',
        ]);

        // "Form not found" (404) is a legitimate outcome when the scholar has
        // no irb-constitution entry yet; what matters is that the capability
        // gate itself, a 403, never fires for the admitted role.
        $this->assertNotSame(403, $response->getStatusCode());
    }
}
