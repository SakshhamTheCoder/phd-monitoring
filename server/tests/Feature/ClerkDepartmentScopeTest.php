<?php

namespace Tests\Feature;

use App\Models\ClerkDepartment;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Uses DatabaseTransactions rather than RefreshDatabase: this suite runs
 * against the configured MySQL database, and rebuilding it per test would be
 * both slow and destructive to a developer's local data.
 */
class ClerkDepartmentScopeTest extends TestCase
{
    use DatabaseTransactions;

    private function clerkFor(Department $department): User
    {
        $role = Role::firstWhere('role', 'clerk');
        $this->assertNotNull($role, 'the clerk role must be seeded');

        $user = User::create([
            'first_name' => 'Scope', 'last_name' => 'Test',
            'email' => 'scope.test.' . uniqid() . '@demo.invalid',
            'password' => bcrypt('irrelevant'), 'phone' => '0000000000',
            'role_id' => $role->id, 'current_role_id' => $role->id, 'default_role_id' => $role->id,
        ]);
        ClerkDepartment::create(['user_id' => $user->id, 'department_id' => $department->id]);

        return $user;
    }

    public function test_a_clerk_is_refused_another_departments_roster(): void
    {
        $departments = Department::orderBy('id')->take(2)->get();
        if ($departments->count() < 2) {
            $this->markTestSkipped('needs at least two departments seeded');
        }

        $clerk = $this->clerkFor($departments[0]);

        $this->actingAs($clerk, 'sanctum')
            ->getJson('/api/clerks/attendance?department_id=' . $departments[1]->id)
            ->assertStatus(403);
    }

    public function test_a_clerk_may_read_their_own_departments_roster(): void
    {
        $departments = Department::orderBy('id')->take(1)->get();
        if ($departments->isEmpty()) {
            $this->markTestSkipped('needs a department seeded');
        }

        $clerk = $this->clerkFor($departments[0]);

        $this->actingAs($clerk, 'sanctum')
            ->getJson('/api/clerks/attendance?department_id=' . $departments[0]->id)
            ->assertStatus(200)
            ->assertJsonStructure(['date', 'students']);
    }

    public function test_a_clerk_cannot_write_attendance_for_another_department(): void
    {
        $departments = Department::orderBy('id')->take(2)->get();
        if ($departments->count() < 2) {
            $this->markTestSkipped('needs at least two departments seeded');
        }

        $outsider = \App\Models\Student::where('department_id', $departments[1]->id)->first();
        if (!$outsider) {
            $this->markTestSkipped('needs a student in the second department');
        }

        $clerk = $this->clerkFor($departments[0]);

        $this->actingAs($clerk, 'sanctum')
            ->postJson('/api/clerks/attendance', [
                'date' => now()->toDateString(),
                'records' => [['roll_no' => $outsider->roll_no, 'status' => 'absent']],
            ])
            ->assertStatus(403);
    }

    public function test_a_clerk_is_refused_another_departments_export(): void
    {
        $departments = Department::orderBy('id')->take(2)->get();
        if ($departments->count() < 2) {
            $this->markTestSkipped('needs at least two departments seeded');
        }

        $clerk = $this->clerkFor($departments[0]);

        $this->actingAs($clerk, 'sanctum')
            ->getJson('/api/clerks/attendance/export?department_id=' . $departments[1]->id)
            ->assertStatus(403);
    }
}
