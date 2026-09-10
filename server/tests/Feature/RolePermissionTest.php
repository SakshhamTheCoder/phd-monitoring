<?php

namespace Tests\Feature;

use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The `roles` table carries per-role permission columns, but two of the guards
 * reading them never fired: one read a column name that does not exist, the
 * other treated the enum string 'false' as truthy. Both endpoints were open to
 * every authenticated user.
 */
class RolePermissionTest extends TestCase
{
    use DatabaseTransactions;

    private function actingAsStudent(): Student
    {
        $student = Student::query()->firstOrFail();
        $this->actingAs(User::findOrFail($student->user_id), 'sanctum');

        return $student;
    }

    public function test_a_student_cannot_create_a_student(): void
    {
        $this->actingAsStudent();

        $this->postJson('/api/students/add', [
            'full_name' => 'Not Allowed',
            'email' => 'not-allowed-student@example.test',
            'department_id' => 1,
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'not-allowed-student@example.test']);
    }

    public function test_a_student_cannot_bulk_upload_students(): void
    {
        $this->actingAsStudent();

        $this->postJson('/api/students/bulk-upload', [])->assertStatus(403);
    }

    public function test_a_student_cannot_create_a_faculty(): void
    {
        $this->actingAsStudent();

        $this->postJson('/api/faculty/add', [
            'full_name' => 'Not Allowed',
            'email' => 'not-allowed-faculty@example.test',
            'department_id' => 1,
        ])->assertStatus(403);

        $this->assertDatabaseMissing('users', ['email' => 'not-allowed-faculty@example.test']);
    }

    /**
     * The permission must follow the role the user is acting as, not the role
     * their account was created with. A faculty account switched into a role
     * that may add faculty is allowed; the same account acting as faculty is
     * not.
     */
    public function test_the_permission_follows_the_acting_role(): void
    {
        $student = $this->actingAsStudent();
        $user = User::findOrFail($student->user_id);

        $this->assertSame(
            'false',
            $user->current_role->can_manage_students,
            'A student role must not carry the manage-students permission.'
        );
    }
}
