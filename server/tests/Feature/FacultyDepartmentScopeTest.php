<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * A PhD coordinator maintains their own department's faculty, and only theirs.
 *
 * The capability alone is institute wide, so the boundary lives in the write
 * endpoints. These pin the two ways it could leak: editing someone in another
 * department by their faculty code, which the directory would never show them,
 * and moving one of their own out to a department they do not answer for.
 */
class FacultyDepartmentScopeTest extends TestCase
{
    use DatabaseTransactions;

    private function coordinatorIn(Department $department): User
    {
        $faculty = Faculty::where('department_id', $department->id)->whereNotNull('user_id')->firstOrFail();

        $user = $faculty->user;
        $user->current_role_id = Role::where('role', 'phd_coordinator')->firstOrFail()->id;
        $user->save();

        // The grant the migration makes on deploy.
        Role::where('role', 'phd_coordinator')->update(['can_manage_faculties' => 'true']);

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    private function twoDepartments(): array
    {
        // Department has no faculty relationship, so ask the faculty side.
        $ids = Faculty::whereNotNull('user_id')
            ->select('department_id')
            ->groupBy('department_id')
            ->havingRaw('COUNT(*) > 1')
            ->pluck('department_id')
            ->take(2);

        if ($ids->count() < 2) {
            $this->markTestSkipped('needs two departments that have faculty');
        }

        return [Department::findOrFail($ids[0]), Department::findOrFail($ids[1])];
    }

    public function test_a_coordinator_may_update_faculty_in_their_own_department(): void
    {
        [$own] = $this->twoDepartments();
        $this->coordinatorIn($own);

        $target = Faculty::where('department_id', $own->id)->whereNotNull('user_id')->firstOrFail();

        $this->putJson('/api/faculty/update/' . $target->faculty_code, [
            'email' => $target->user->email,
            'phone' => $target->user->phone ?: '9800000000',
            'designation' => $target->designation,
            'faculty_code' => (string) $target->faculty_code,
        ])->assertOk();
    }

    public function test_a_coordinator_may_not_touch_another_department(): void
    {
        [$own, $other] = $this->twoDepartments();
        $this->coordinatorIn($own);

        $outsider = Faculty::where('department_id', $other->id)->whereNotNull('user_id')->firstOrFail();

        $this->putJson('/api/faculty/update/' . $outsider->faculty_code, [
            'email' => $outsider->user->email,
            'phone' => '9800000001',
            'designation' => $outsider->designation,
            'faculty_code' => (string) $outsider->faculty_code,
        ])->assertForbidden();

        $this->postJson('/api/faculty/add', [
            'full_name' => 'New Person',
            'email' => 'new.person.' . uniqid() . '@thapar.edu',
            'phone' => '9800000002',
            'designation' => 'Assistant Professor',
            'faculty_code' => (string) random_int(980000, 989999),
            'department_id' => $other->id,
        ])->assertForbidden();
    }

    public function test_a_coordinator_may_not_move_their_own_faculty_out_of_reach(): void
    {
        [$own, $other] = $this->twoDepartments();
        $this->coordinatorIn($own);

        $target = Faculty::where('department_id', $own->id)->whereNotNull('user_id')->firstOrFail();

        $this->putJson('/api/faculty/update/' . $target->faculty_code, [
            'email' => $target->user->email,
            'phone' => $target->user->phone ?: '9800000003',
            'designation' => $target->designation,
            'faculty_code' => (string) $target->faculty_code,
            'department_id' => $other->id,
        ])->assertForbidden();

        $this->assertSame($own->id, $target->fresh()->department_id);
    }

    public function test_an_admin_is_unscoped(): void
    {
        [$own, $other] = $this->twoDepartments();

        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        $outsider = Faculty::where('department_id', $other->id)->whereNotNull('user_id')->firstOrFail();

        $this->putJson('/api/faculty/update/' . $outsider->faculty_code, [
            'email' => $outsider->user->email,
            'phone' => $outsider->user->phone ?: '9800000004',
            'designation' => $outsider->designation,
            'faculty_code' => (string) $outsider->faculty_code,
        ])->assertOk();
    }
}
