<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

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

        // 404 is fine here, a missing form record; only the 403 gate matters.
        $this->assertNotSame(403, $response->getStatusCode());
    }
}
