<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\User;
use Database\Seeders\TestFixturesSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The course and area pages' APIs answer the roles the menu offers the page
 * (config/navigation.php) and no others. The lists used to answer anyone
 * signed in, and the DoRDC, DRA and Director could write areas they were never
 * offered.
 */
class AreaPagesAnswerOnlyTheirRolesTest extends TestCase
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

    public function test_only_course_managers_read_the_course_list(): void
    {
        foreach (['student', 'faculty', 'dordc'] as $role) {
            $this->actingAs($this->account($role));
            foreach (['/api/courses/list', '/api/courses/filters'] as $path) {
                $this->getJson($path)->assertForbidden();
            }
        }
        $this->actingAs($this->account('admin'))->getJson('/api/courses/list')->assertOk();

        // The full list also feeds Tag course on a scholar's profile, so those
        // who manage scholars read it too.
        foreach (['student', 'faculty'] as $role) {
            $this->actingAs($this->account($role))->getJson('/api/courses/all')->assertForbidden();
        }
        foreach (['dordc', 'hod'] as $role) {
            $this->actingAs($this->account($role))->getJson('/api/courses/all')->assertOk();
        }
    }

    public function test_only_the_roles_offered_the_area_page_read_or_write_it(): void
    {
        $departmentId = Department::where('code', TestFixturesSeeder::DEPARTMENT_CODE)->value('id');
        $areaId = DB::table('area_of_specializations')->insertGetId(['name' => 'Gate area', 'department_id' => $departmentId]);
        $body = ['name' => 'Renamed', 'department_id' => $departmentId];

        foreach (['dordc', 'dra', 'director', 'student'] as $role) {
            $this->actingAs($this->account($role));
            $this->getJson('/api/departments/area-of-specialization/list')->assertForbidden();
            $this->getJson('/api/departments/area-of-specialization/filters')->assertForbidden();
            $this->putJson("/api/departments/area-of-specialization/update/{$areaId}", $body)->assertForbidden();
        }
        $this->assertDatabaseHas('area_of_specializations', ['id' => $areaId, 'name' => 'Gate area']);

        // The plain list feeds dropdowns on profile forms, so it stays open.
        $this->actingAs($this->account('dordc'))->getJson("/api/departments/area-of-specialization?department_id={$departmentId}")->assertOk();

        $this->actingAs($this->account('admin'));
        $this->getJson('/api/departments/area-of-specialization/list')->assertOk();
        $this->putJson("/api/departments/area-of-specialization/update/{$areaId}", $body)->assertOk();
    }
}
