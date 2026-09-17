<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Presentation;
use App\Models\User;
use Database\Seeders\TestFixturesSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Writes that checked nothing about the caller, found by the role sweep. Each
 * request carries a valid body, so a refusal is the guard and not validation.
 */
class UngatedWritesAreRefusedTest extends TestCase
{
    use DatabaseTransactions;

    private function account(string $role): User
    {
        $user = User::where('email', "{$role}@fixture.test")->first();
        if (!$user) {
            $this->markTestSkipped("No {$role}@fixture.test account. Seed TestFixturesSeeder.");
        }
        return $user;
    }

    private function department(): Department
    {
        return Department::where('code', TestFixturesSeeder::DEPARTMENT_CODE)->firstOrFail();
    }

    public function test_only_admin_creates_a_role(): void
    {
        $body = ['role' => 'sweep_probe_role', 'can_manage_users' => true];

        $this->actingAs($this->account('student'))->postJson('/api/roles/add', $body)->assertForbidden();
        $this->actingAs($this->account('external'))->postJson('/api/roles/add', $body)->assertForbidden();
        $this->assertDatabaseMissing('roles', ['role' => 'sweep_probe_role']);
    }

    public function test_the_role_list_needs_a_signed_in_account(): void
    {
        $this->getJson('/api/roles')->assertUnauthorized();
    }

    public function test_only_course_managers_change_courses(): void
    {
        $departmentId = $this->department()->id;
        $courseId = DB::table('courses')->insertGetId([
            'course_code' => 'SWEEP101', 'course_name' => 'Sweep', 'credits' => 3, 'department_id' => $departmentId,
        ]);
        $body = ['course_code' => 'SWEEP102', 'course_name' => 'Sweep', 'credits' => 3, 'department_id' => $departmentId];

        foreach (['student', 'faculty', 'clerk', 'ug_student'] as $role) {
            $this->actingAs($this->account($role));
            $this->postJson('/api/courses/add', $body)->assertForbidden();
            $this->putJson("/api/courses/update/{$courseId}", $body)->assertForbidden();
            $this->deleteJson("/api/courses/delete/{$courseId}")->assertForbidden();
            $this->postJson('/api/courses/import', [])->assertForbidden();
        }
        $this->assertDatabaseHas('courses', ['id' => $courseId, 'course_code' => 'SWEEP101']);

        $this->actingAs($this->account('admin'))->postJson('/api/courses/add', $body)->assertSuccessful();
    }

    public function test_a_head_manages_only_their_own_departments_courses(): void
    {
        $own = $this->department();
        $other = Department::where('code', TestFixturesSeeder::SECOND_DEPARTMENT_CODE)->firstOrFail();
        $otherCourseId = DB::table('courses')->insertGetId([
            'course_code' => 'SWEEP201', 'course_name' => 'Other', 'credits' => 3, 'department_id' => $other->id,
        ]);
        $this->actingAs($this->account('hod'));

        // The page sends no department for a head; one naming another is ignored.
        $this->postJson('/api/courses/add', ['course_code' => 'SWEEP202', 'course_name' => 'Own', 'credits' => 3])->assertOk();
        $this->postJson('/api/courses/add', ['course_code' => 'SWEEP203', 'course_name' => 'Own', 'credits' => 3, 'department_id' => $other->id])->assertOk();
        $this->assertSame(2, DB::table('courses')->whereIn('course_code', ['SWEEP202', 'SWEEP203'])->where('department_id', $own->id)->count());

        $this->putJson("/api/courses/update/{$otherCourseId}", ['course_code' => 'SWEEP201', 'course_name' => 'Taken', 'credits' => 3])->assertForbidden();
        $this->deleteJson("/api/courses/delete/{$otherCourseId}")->assertForbidden();
        $this->assertDatabaseHas('courses', ['id' => $otherCourseId, 'course_name' => 'Other']);
    }

    public function test_only_area_managers_rename_or_delete_an_area(): void
    {
        $departmentId = $this->department()->id;
        $areaId = DB::table('area_of_specializations')->insertGetId(['department_id' => $departmentId, 'name' => 'Sweep area']);

        foreach (['student', 'faculty', 'clerk'] as $role) {
            $this->actingAs($this->account($role));
            $this->putJson("/api/departments/area-of-specialization/update/{$areaId}", ['name' => 'Renamed', 'department_id' => $departmentId])->assertForbidden();
            $this->deleteJson("/api/departments/area-of-specialization/delete/{$areaId}")->assertForbidden();
        }
        $this->assertDatabaseHas('area_of_specializations', ['id' => $areaId, 'name' => 'Sweep area']);

        $this->actingAs($this->account('admin'))
            ->putJson("/api/departments/area-of-specialization/update/{$areaId}", ['name' => 'Renamed', 'department_id' => $departmentId])
            ->assertOk();
    }

    public function test_a_scholar_cannot_link_or_unlink_on_another_scholars_form(): void
    {
        $other = Presentation::create([
            'student_id' => TestFixturesSeeder::SECOND_STUDENT_ROLL,
            'period_of_report' => '2627ODD',
            'status' => 'pending',
            'completion' => 'incomplete',
            'steps' => ['student', 'faculty', 'complete'],
        ]);

        $this->actingAs($this->account('student'));
        foreach (['link', 'unlink'] as $action) {
            $this->postJson("/api/presentation/semester/2627ODD/{$other->id}/{$action}", ['publications' => [], 'patents' => []])
                ->assertForbidden();
        }
    }
}
