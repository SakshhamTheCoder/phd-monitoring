<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\TestFixturesSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Panels on a scholar's profile that refused readers the profile itself lets
 * in. Courses asked for the course-manager capability, so the HOD and the
 * supervisor saw an empty panel; the forms list had no ADoRDC branch at all.
 */
class ScholarProfilePanelsTest extends TestCase
{
    use DatabaseTransactions;

    private function courses(string $email)
    {
        $user = User::where('email', $email)->first();
        if (!$user) {
            $this->markTestSkipped("No {$email}. Seed TestFixturesSeeder.");
        }
        $this->app['auth']->forgetGuards();
        return $this->actingAs($user)->getJson('/api/courses/student/courses/' . TestFixturesSeeder::STUDENT_ROLL);
    }

    public function test_whoever_can_open_the_profile_reads_its_courses(): void
    {
        $this->courses('hod@fixture.test')->assertOk();
        $this->courses('supervisor@fixture.test')->assertOk();
        $this->courses('scholar@fixture.test')->assertOk();
    }

    public function test_the_adordc_reads_the_forms_of_a_scholar_in_their_department(): void
    {
        $adordc = User::where('email', 'adordc@fixture.test')->first();
        if (!$adordc) {
            $this->markTestSkipped('No adordc@fixture.test. Seed TestFixturesSeeder.');
        }

        $this->actingAs($adordc)->getJson('/api/students/' . TestFixturesSeeder::STUDENT_ROLL . '/forms')->assertOk();
    }

    public function test_nobody_else_does(): void
    {
        $this->courses('outsider@fixture.test')->assertForbidden();
        $this->courses('scholar2@fixture.test')->assertForbidden();
        $this->courses('clerk@fixture.test')->assertForbidden();
    }
}
