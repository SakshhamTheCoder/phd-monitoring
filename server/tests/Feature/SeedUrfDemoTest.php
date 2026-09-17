<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\UgBranch;
use App\Models\UrfApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The demonstration seeder runs against real data, so it has to be exact about
 * what it touches: the named student, the sessions asked for, and nothing else.
 */
class SeedUrfDemoTest extends TestCase
{
    use DatabaseTransactions;

    public function test_it_fills_in_a_project_per_session_and_can_be_run_again(): void
    {
        $student = User::where('email', 'ug_student@fixture.test')->first();
        $mentor = Faculty::where('type', 'internal')->whereHas('user')->with('user')->first();
        $department = Department::first();
        if (!$student || !$mentor || !$department) {
            $this->markTestSkipped('Needs the UG fixture account, an internal faculty member and a department.');
        }

        // The seeder needs a branch to attach a UG record to, and the suite's
        // transaction takes both away again.
        $branch = UgBranch::first() ?: UgBranch::create([
            'programme' => 'BE', 'code' => 'PROBE', 'name' => 'Probe Engineering', 'department_id' => $department->id,
        ]);
        if (!$student->ugStudent) {
            $student->ugStudent()->create(['roll_no' => '999900001', 'branch_id' => $branch->id, 'year' => 4]);
            $student->refresh();
        }

        $sessions = [2024, 2025];
        $others = UrfApplication::where('user_id', '!=', $student->id)->count();

        $this->artisan('urf:seed-demo', [
            'email' => $student->email,
            '--mentor' => $mentor->user->email,
            '--sessions' => implode(',', $sessions),
        ])->assertSuccessful();

        // Twice, because the office will run it twice sooner or later.
        $this->artisan('urf:seed-demo', [
            'email' => $student->email,
            '--mentor' => $mentor->user->email,
            '--sessions' => implode(',', $sessions),
        ])->assertSuccessful();

        $applications = UrfApplication::where('user_id', $student->id)->whereIn('session', $sessions)->get();
        $this->assertCount(2, $applications, 'one project per session, not one per run');

        foreach ($applications as $application) {
            $this->assertSame($mentor->faculty_code, $application->mentor1_faculty_code);
            $this->assertSame('selected', $application->status);
            $this->assertSame(UrfApplication::COMPLETE, $application->stage);
            $this->assertCount(1, $application->fellows, 'the stipend details');
            $this->assertNotEmpty($application->reports, 'at least the half yearly report');
        }

        $this->assertSame($others, UrfApplication::where('user_id', '!=', $student->id)->count(), 'nobody else was touched');

        $this->artisan('urf:seed-demo', [
            'email' => $student->email,
            '--sessions' => implode(',', $sessions),
            '--undo' => true,
        ])->assertSuccessful();

        $this->assertSame(0, UrfApplication::where('user_id', $student->id)->whereIn('session', $sessions)->count());
    }

    public function test_it_refuses_an_address_with_no_account(): void
    {
        $this->artisan('urf:seed-demo', ['email' => 'nobody.here@fixture.test'])->assertFailed();
    }
}
