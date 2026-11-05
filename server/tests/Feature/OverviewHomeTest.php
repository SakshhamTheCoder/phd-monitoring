<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/** The DORDC's Home is an institution overview; other acting roles keep their profile. */
class OverviewHomeTest extends TestCase
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

    public function test_dordc_gets_the_overview(): void
    {
        $res = $this->actingAs($this->account('dordc'))->getJson('/api/home')->assertOk();
        $res->assertJsonPath('type', 'overview')
            ->assertJsonStructure(['data' => [
                'name', 'role', 'totals' => ['scholars', 'faculty', 'departments'],
                'scholars_by_department', 'scholars_by_status', 'scholars_by_admission_year',
                'progress',
                'forms_pending_by_stage', 'urf_by_status', 'projects_by_status',
                'publications_by_year', 'recent_activity',
            ]]);
    }

    public function test_admin_gets_the_overview(): void
    {
        $this->actingAs($this->account('admin'))->getJson('/api/home')
            ->assertOk()->assertJsonPath('type', 'overview');
    }

    public function test_a_dordc_acting_as_faculty_gets_the_profile_again(): void
    {
        $user = $this->account('dordc');
        $faculty = Role::where('role', 'faculty')->first();
        $user->current_role_id = $faculty->id;
        $user->save();

        $type = $this->actingAs($user->fresh())->getJson('/api/home')->assertOk()->json('type');
        $this->assertContains($type, ['faculty', 'admin']);
    }

    public function test_faculty_and_student_keep_their_shape(): void
    {
        $this->actingAs($this->account('faculty'))->getJson('/api/home')->assertOk()->assertJsonPath('type', 'faculty');
        $this->actingAs($this->account('student'))->getJson('/api/home')->assertOk()->assertJsonPath('type', 'student');
    }
}
