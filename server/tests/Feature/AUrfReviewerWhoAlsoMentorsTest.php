<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\UrfApplication;
use App\Models\User;
use App\Pages\UrfPage;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The DORDC approves every URF project and may mentor one of them.
 *
 * Reading the first step they hold made that project unanswerable: a mentor who
 * is also the DORDC read 'mentor' at every stage, so once the form reached the
 * DORDC step it waited on nobody and could not be approved by anyone. The office
 * cannot stand in either, because a URF decision is not a form step.
 *
 * The same page also hid the "waiting on you" queue from whoever manages URF,
 * which since the DORDC became the office meant the final approver lost the list
 * of what was waiting on them.
 */
class AUrfReviewerWhoAlsoMentorsTest extends TestCase
{
    use DatabaseTransactions;

    private function userAs(string $role, array $capabilities = []): User
    {
        $roleId = Role::where('role', $role)->value('id');
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => 'Urf',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@mentoring.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    /** An application of the given stage, mentored by the given faculty code. */
    private function project(string $stage, int $mentorCode, int $departmentId): UrfApplication
    {
        $application = new UrfApplication();
        $application->forceFill([
            // The applicant's own account, which the model requires.
            'user_id' => $this->userAs('ug_student')->id,
            'project_title' => 'Mentored by a reviewer ' . Str::random(4),
            'session' => (int) now()->year,
            'stage' => $stage,
            'status' => 'applied',
            'student1_name' => 'Ug One',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_email' => Str::lower(Str::random(8)) . '_be24@thapar.edu',
            'student1_department_id' => $departmentId,
            'mentor1_faculty_code' => $mentorCode,
            'proposal' => 'proposal.pdf',
        ])->save();

        return $application->fresh();
    }

    public function test_the_dordc_answers_their_own_project_once_it_reaches_their_step(): void
    {
        $department = Department::firstOrCreate(['code' => 'MNTRD'], ['name' => 'Mentoring Test Department']);
        $dordc = $this->userAs('dordc', ['can_manage_urf' => 'true']);
        Faculty::create([
            'faculty_code' => 990301,
            'user_id' => $dordc->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);
        $dordc = $dordc->fresh();

        $theirs = $this->project('dordc', 990301, $department->id);

        $this->assertSame('dordc', $theirs->stepFor($dordc), 'the step the form has reached, not the first they hold');
        $this->assertTrue($theirs->awaits($dordc));

        // And while it is still with the mentor, they answer as the mentor.
        $earlier = $this->project('mentor', 990301, $department->id);
        $this->assertSame('mentor', $earlier->stepFor($dordc));
        $this->assertTrue($earlier->awaits($dordc));
    }

    public function test_the_queue_still_reaches_the_dordc_now_that_they_manage_urf(): void
    {
        $department = Department::firstOrCreate(['code' => 'MNTRD'], ['name' => 'Mentoring Test Department']);
        $dordc = $this->userAs('dordc', ['can_manage_urf' => 'true']);
        $mentor = $this->userAs('faculty');
        Faculty::create([
            'faculty_code' => 990302,
            'user_id' => $mentor->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);

        $waiting = $this->project('dordc', 990302, $department->id);

        $this->actingAs($dordc, 'sanctum');
        $view = (new UrfPage())->view($dordc->fresh());
        $blocks = array_column(array_filter($view['above'], fn ($part) => isset($part['block'])), 'block');

        $this->assertContains('urf-queue', $blocks, 'the final approver reads what waits on them');

        $queue = collect($view['above'])->firstWhere('block', 'urf-queue');
        $this->assertContains($waiting->project_title, array_column($queue['props']['rows'], 'project_title'));
    }

    public function test_the_office_that_holds_no_step_still_has_no_queue(): void
    {
        $department = Department::firstOrCreate(['code' => 'MNTRD'], ['name' => 'Mentoring Test Department']);
        $admin = $this->userAs('admin', ['can_manage_urf' => 'true']);
        $mentor = $this->userAs('faculty');
        Faculty::create([
            'faculty_code' => 990303,
            'user_id' => $mentor->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);

        $this->project('dordc', 990303, $department->id);

        $this->actingAs($admin, 'sanctum');
        $view = (new UrfPage())->view($admin->fresh());
        $blocks = array_column(array_filter($view['above'], fn ($part) => isset($part['block'])), 'block');

        $this->assertNotContains('urf-queue', $blocks, 'admin holds no step on a URF chain');
    }
}
