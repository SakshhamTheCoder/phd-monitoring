<?php

namespace Tests\Feature;

use App\Models\Presentation;
use App\Models\Student;
use App\Models\SynopsisSubmission;
use App\Models\User;
use Database\Seeders\TestFixturesSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * An approved evaluation read back later. The starting figure came from the
 * scholar's overall progress today, which already includes the increase, so
 * the form read "previous 60, increase 10, total 60".
 */
class ProgressFiguresAfterApprovalTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $admin = User::where('email', 'admin@fixture.test')->first();
        if (!$admin) {
            $this->markTestSkipped('No admin@fixture.test. Seed TestFixturesSeeder.');
        }
        return $admin;
    }

    public function test_an_approved_evaluation_shows_where_it_started(): void
    {
        Student::where('roll_no', TestFixturesSeeder::STUDENT_ROLL)->update(['overall_progress' => 60]);
        $evaluation = Presentation::create([
            'student_id' => TestFixturesSeeder::STUDENT_ROLL,
            'period_of_report' => '2627ODD',
            'status' => 'approved',
            'completion' => 'complete',
            'stage' => 'complete',
            'steps' => ['student', 'faculty', 'complete'],
        ]);
        $evaluation->forceFill(['supervisor_lock' => 1, 'current_progress' => 50, 'progress' => 10, 'total_progress' => 60])->save();

        $this->actingAs($this->admin())
            ->getJson("/api/presentation/semester/2627ODD/{$evaluation->id}")
            ->assertOk()
            ->assertJsonPath('current_progress', 50)
            ->assertJsonPath('total_progress', 60);
    }

    public function test_an_approved_synopsis_shows_where_it_started(): void
    {
        Student::where('roll_no', TestFixturesSeeder::STUDENT_ROLL)->update(['overall_progress' => 60]);
        $synopsis = SynopsisSubmission::create([
            'student_id' => TestFixturesSeeder::STUDENT_ROLL,
            'status' => 'approved',
            'completion' => 'complete',
            'stage' => 'complete',
            'steps' => ['student', 'faculty', 'complete'],
        ]);
        $synopsis->forceFill(['supervisor_lock' => 1, 'current_progress' => 10, 'total_progress' => 60])->save();

        $this->actingAs($this->admin())
            ->getJson("/api/forms/synopsis-submission/{$synopsis->id}")
            ->assertOk()
            ->assertJsonPath('previous_progress', 50);
    }
}
