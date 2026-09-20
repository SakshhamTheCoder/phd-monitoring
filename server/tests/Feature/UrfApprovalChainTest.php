<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\UgBranch;
use App\Models\UrfApplication;
use App\Models\UrfReportWindow;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A URF form read in turn: the student files it, the mentor reads it, then the
 * ADORDC of the student's branch, then the DORDC, and the project is on.
 */
class UrfApprovalChainTest extends TestCase
{
    use DatabaseTransactions;

    private function userAs(string $role, array $capabilities = []): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => ucfirst($role),
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@chain.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function faculty(int $code, Department $department): Faculty
    {
        return Faculty::create([
            'faculty_code' => $code,
            'user_id' => $this->userAs('faculty')->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);
    }

    public function test_a_form_is_read_in_turn_and_a_rejection_goes_back_to_the_student(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);

        $department = Department::create(['name' => 'Chain Test Department', 'code' => 'CHNTD']);
        $branch = UgBranch::create([
            'programme' => 'BE',
            'code' => 'CHNTB',
            'name' => 'Chain Test Branch',
            'department_id' => $department->id,
        ]);

        $mentor = $this->faculty(990101, $department);

        // An ADORDC holds departments, which is how a form finds the right one.
        $adordcFaculty = $this->faculty(990102, $department);
        $adordc = $adordcFaculty->user;
        $adordc->forceFill(['current_role_id' => Role::where('role', 'adordc')->value('id')])->save();
        $department->adordc_id = $adordcFaculty->faculty_code;
        $department->save();

        $dordc = $this->userAs('dordc');

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $form = [
            'project_title' => 'Chain project ' . Str::random(4),
            'student1_name' => 'Chain Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Male',
            'student1_email' => $student->email,
            'student1_phone' => '9800000011',
            'mentor1_faculty_code' => $mentor->faculty_code,
        ];
        $pdf = fn () => UploadedFile::fake()->create('proposal.pdf', 10, 'application/pdf');

        $id = $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['proposal' => $pdf()])
            ->assertCreated()->json('id');

        $application = UrfApplication::find($id);
        $this->assertSame('mentor', $application->stage, 'a filed application waits on the mentor');

        $decide = fn (User $actor, array $body) => $this->actingAs($actor, 'sanctum')
            ->postJson("/api/urf/urf-application/{$id}/decision", $body);

        // Nobody reads it out of turn.
        $decide($adordc, ['decision' => 'approve'])->assertStatus(403);
        $decide($dordc, ['decision' => 'approve'])->assertStatus(403);

        // Sending it back has to say what to fix.
        $decide($mentor->user, ['decision' => 'send_back'])->assertStatus(422);

        // And ending the project is not the mentor's to do.
        $decide($mentor->user, ['decision' => 'reject', 'comments' => 'No.'])->assertStatus(403);

        $decide($mentor->user, ['decision' => 'send_back', 'comments' => 'Narrow the scope.'])->assertOk();
        $application->refresh();
        $this->assertSame('student', $application->stage, 'it goes back to the student');
        $this->assertSame('Narrow the scope.', $application->mentor_comments);
        $this->assertSame('applied', $application->status);

        // Correcting it starts the reading again.
        $this->actingAs($student, 'sanctum')->postJson('/api/urf', $form + ['project_title' => 'Chain project, narrower'])->assertOk();
        $application->refresh();
        $this->assertSame('mentor', $application->stage);
        $this->assertFalse((bool) $application->mentor_approval, 'the old answer is spent');

        $decide($mentor->user, ['decision' => 'approve'])->assertOk()->assertJsonPath('stage', 'adordc');
        $decide($mentor->user, ['decision' => 'approve'])->assertStatus(403);
        $decide($adordc, ['decision' => 'approve'])->assertOk()->assertJsonPath('stage', 'dordc');

        // The last approval is the project being selected.
        $decide($dordc, ['decision' => 'approve'])
            ->assertOk()
            ->assertJsonPath('stage', 'complete')
            ->assertJsonPath('status', 'selected');

        $application->refresh();
        $this->assertSame('selected', $application->status);
        // Filed, sent back, corrected, then read three times.
        $this->assertCount(6, $application->history, 'every hop is on the record');

        // And nothing more is read on a form that is through.
        $decide($dordc, ['decision' => 'approve'])->assertStatus(422);
    }

    /**
     * Each form has a page of its own, in the shape the PhD form pages read:
     * the chain, where it has reached, what each step said, and what was
     * filled in. The stipend details on it are masked for an approver.
     */
    public function test_each_form_has_a_page_of_its_own_in_the_shape_the_form_pages_read(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $outsider = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);

        $department = Department::create(['name' => 'Page Test Department', 'code' => 'PAGTD']);
        $branch = UgBranch::create([
            'programme' => 'BE',
            'code' => 'PAGTB',
            'name' => 'Page Test Branch',
            'department_id' => $department->id,
        ]);

        $mentor = $this->faculty(990141, $department);
        $adordcFaculty = $this->faculty(990142, $department);
        $adordc = $adordcFaculty->user;
        $adordc->forceFill(['current_role_id' => Role::where('role', 'adordc')->value('id')])->save();
        $department->adordc_id = $adordcFaculty->faculty_code;
        $department->save();
        $dordc = $this->userAs('dordc');

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $id = $this->actingAs($student, 'sanctum')->postJson('/api/urf', [
            'project_title' => 'Page project ' . Str::random(4),
            'student1_name' => 'Page Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Male',
            'student1_email' => $student->email,
            'student1_phone' => '9800000021',
            'mentor1_faculty_code' => $mentor->faculty_code,
            'proposal' => UploadedFile::fake()->create('proposal.pdf', 10, 'application/pdf'),
        ])->assertCreated()->json('id');

        $page = "/api/urf/urf-application/{$id}";
        $steps = ['student', 'mentor', 'adordc', 'dordc', 'complete'];

        // The mentor's own step is where it has reached, so the page offers it.
        $this->actingAs($mentor->user, 'sanctum')->getJson($page)->assertOk()
            ->assertJsonPath('form_id', $id)
            ->assertJsonPath('form_name', 'URF Application Form')
            ->assertJsonPath('stage', 'mentor')
            ->assertJsonPath('steps', $steps)
            ->assertJsonPath('current_step', 1)
            ->assertJsonPath('role', 'mentor')
            ->assertJsonPath('awaiting_me', true)
            // Ending a project is the DORDC's alone, and only on the application.
            ->assertJsonPath('may_reject', false)
            ->assertJsonPath('locks.mentor', false)
            ->assertJsonPath('application.project_title', UrfApplication::find($id)->project_title);

        // The office holds no step, so it reads the form the way an admin reads
        // a PhD one: every panel, none of them live.
        $this->actingAs($admin, 'sanctum')->getJson($page)->assertOk()
            ->assertJsonPath('role', 'admin')
            ->assertJsonPath('awaiting_me', false);

        // A student of another project is not on this chain.
        $this->actingAs($outsider, 'sanctum')->getJson($page)->assertForbidden();

        // A student of this one reads their own form under /forms, which is
        // the same form and so the same page. They hold the first step, so
        // that is all the ladder gives them.
        $this->actingAs($student, 'sanctum')->getJson($page)->assertOk()
            ->assertJsonPath('role', 'student')
            ->assertJsonPath('awaiting_me', false);

        // The shared recommendation field answers with approval rather than a
        // decision, and the endpoint reads it as the decision it means.
        $this->actingAs($mentor->user, 'sanctum')
            ->postJson("{$page}/decision", ['approval' => true, 'rejected' => false, 'comments' => 'Worth doing.'])
            ->assertOk()->assertJsonPath('stage', 'adordc');

        // A bare submit is not a decision.
        $this->actingAs($adordc, 'sanctum')->postJson("{$page}/decision", [])->assertStatus(422);

        $this->actingAs($adordc, 'sanctum')->getJson($page)->assertOk()
            ->assertJsonPath('role', 'adordc')
            ->assertJsonPath('current_step', 2)
            // The step behind them is answered, and reads as answered.
            ->assertJsonPath('locks.mentor', true)
            ->assertJsonPath('approvals.mentor', true)
            ->assertJsonPath('comments.mentor', 'Worth doing.')
            ->assertJsonPath('locks.adordc', false)
            // Filing it is the first line of the history, then each answer.
            ->assertJsonPath('history.0.action', 'Submitted by ' . $student->name() . ' (the student)')
            ->assertJsonPath('history.1.action', 'Recommended by ' . $mentor->user->name() . ' (the faculty mentor)')
            ->assertJsonPath('history.1.comment', 'Worth doing.');

        $this->actingAs($adordc, 'sanctum')->postJson("{$page}/decision", ['approval' => true])->assertOk();
        $this->actingAs($dordc, 'sanctum')->getJson($page)->assertOk()->assertJsonPath('may_reject', true);
        $this->actingAs($dordc, 'sanctum')->postJson("{$page}/decision", ['approval' => true])
            ->assertOk()->assertJsonPath('status', 'selected');

        $this->actingAs($mentor->user, 'sanctum')->getJson($page)->assertOk()
            ->assertJsonPath('stage', 'complete')
            ->assertJsonPath('current_step', 4)
            ->assertJsonPath('awaiting_me', false)
            ->assertJsonPath('locks.dordc', true);

        // The stipend details are a form of their own, on a page of their own.
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/fellow", [
            'full_name' => 'Page Student', 'dob' => '2004-01-02', 'gender' => 'Male', 'father_name' => 'Someone',
            'pan' => 'abcde9876z', 'aadhaar' => '4321 8765 2109', 'bank_name' => 'PNB',
            'account_no' => '987654321098', 'ifsc' => 'punb0001234',
        ])->assertOk();

        $fellowId = DB::table('urf_fellows')->where('urf_application_id', $id)->value('id');
        $fellowPage = "/api/urf/urf-additional-info/{$fellowId}";

        // An approver is checking that the person is who they say, not their
        // bank, so they read the last four digits of what identifies them.
        $this->actingAs($mentor->user, 'sanctum')->getJson($fellowPage)->assertOk()
            ->assertJsonPath('form_name', 'Additional Information Form')
            ->assertJsonPath('stage', 'mentor')
            ->assertJsonPath('filled.full_name', 'Page Student')
            ->assertJsonPath('filled.pan', 'XXXXXX876Z')
            ->assertJsonPath('filled.account_no', 'XXXXXXXX1098');

        // The office, and the student who gave them, read them whole.
        $this->actingAs($admin, 'sanctum')->getJson($fellowPage)->assertOk()
            ->assertJsonPath('filled.pan', 'ABCDE9876Z')
            ->assertJsonPath('filled.account_no', '987654321098');
        $this->actingAs($student, 'sanctum')->getJson($fellowPage)->assertOk()
            ->assertJsonPath('role', 'student')
            ->assertJsonPath('filled.pan', 'ABCDE9876Z');
    }

    public function test_the_dordc_ends_a_project_and_the_student_may_apply_again(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Reject Test Department', 'code' => 'REJTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'REJTB', 'name' => 'Reject Test Branch', 'department_id' => $department->id]);
        $mentor = $this->faculty(990131, $department);
        $adordcFaculty = $this->faculty(990132, $department);
        $adordc = $adordcFaculty->user;
        $adordc->forceFill(['current_role_id' => Role::where('role', 'adordc')->value('id')])->save();
        $department->adordc_id = $adordcFaculty->faculty_code;
        $department->save();
        $dordc = $this->userAs('dordc');

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $form = [
            'project_title' => 'Doomed project ' . Str::random(4),
            'student1_name' => 'Reject Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Male',
            'student1_email' => $student->email,
            'student1_phone' => '9800000014',
            'mentor1_faculty_code' => $mentor->faculty_code,
        ];

        $id = $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['proposal' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf')])
            ->assertCreated()->json('id');

        $decide = fn (User $actor, array $body) => $this->actingAs($actor, 'sanctum')
            ->postJson("/api/urf/urf-application/{$id}/decision", $body);

        $decide($mentor->user, ['decision' => 'approve'])->assertOk();
        $decide($adordc, ['decision' => 'approve'])->assertOk();

        // Ending it has to say why, and then it is over.
        $decide($dordc, ['decision' => 'reject'])->assertStatus(422);
        $decide($dordc, ['decision' => 'reject', 'comments' => 'Outside the fellowship.'])
            ->assertOk()
            ->assertJsonPath('status', 'rejected')
            ->assertJsonPath('stage', 'complete');

        $application = UrfApplication::find($id);
        $this->assertSame('rejected', $application->status);
        $this->assertSame('Outside the fellowship.', $application->dordc_comments);

        // A rejected project closes the forms behind it.
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/fellow", [
            'full_name' => 'Reject Student', 'dob' => '2004-01-01', 'gender' => 'Male', 'father_name' => 'A Parent',
            'pan' => 'ABCDE1234F', 'aadhaar' => '123456789012', 'bank_name' => 'SBI',
            'account_no' => '123456789012', 'ifsc' => 'SBIN0001234',
        ])->assertStatus(422);

        // And leaves the student free to apply again.
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + [
                'project_title' => 'Second attempt',
                'proposal' => UploadedFile::fake()->create('p2.pdf', 10, 'application/pdf'),
            ])
            ->assertCreated();
    }

    public function test_the_office_override_closes_the_reading_as_well(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Override Test Department', 'code' => 'OVRTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'OVRTB', 'name' => 'Override Test Branch', 'department_id' => $department->id]);
        $mentor = $this->faculty(990141, $department);

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();
        $id = $this->actingAs($student, 'sanctum')->postJson('/api/urf', [
            'project_title' => 'Override project ' . Str::random(4),
            'student1_name' => 'Override Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Female',
            'student1_email' => $student->email,
            'student1_phone' => '9800000015',
            'mentor1_faculty_code' => $mentor->faculty_code,
            'proposal' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf'),
        ])->assertCreated()->json('id');

        $this->assertSame('mentor', UrfApplication::find($id)->stage);

        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'selected'])->assertOk();

        $application = UrfApplication::find($id);
        $this->assertSame('selected', $application->status);
        $this->assertSame('complete', $application->stage, 'nothing is left waiting on anyone');
    }

    public function test_a_report_is_filed_only_while_its_round_is_open(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Round Test Department', 'code' => 'RNDTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'RNDTB', 'name' => 'Round Test Branch', 'department_id' => $department->id]);
        $mentor = $this->faculty(990121, $department);

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();
        $id = $this->actingAs($student, 'sanctum')->postJson('/api/urf', [
            'project_title' => 'Round project ' . Str::random(4),
            'student1_name' => 'Round Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Male',
            'student1_email' => $student->email,
            'student1_phone' => '9800000013',
            'mentor1_faculty_code' => $mentor->faculty_code,
            'proposal' => UploadedFile::fake()->create('proposal.pdf', 10, 'application/pdf'),
        ])->assertCreated()->json('id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'selected'])->assertOk();

        $file = fn () => ['type' => 'half_yearly', 'report' => UploadedFile::fake()->create('r.pdf', 10, 'application/pdf')];

        // Nothing is scheduled, so there is nothing to file.
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/reports", $file())
            ->assertStatus(422)
            ->assertJsonPath('message', 'This report has not been scheduled yet.');

        // A round that has closed is no better.
        $this->actingAs($admin, 'sanctum')->postJson('/api/urf/report-windows', [
            'session' => (int) now()->year,
            'type' => 'half_yearly',
            'opens_on' => now()->subMonth()->toDateString(),
            'closes_on' => now()->subWeek()->toDateString(),
        ])->assertCreated();
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/reports", $file())->assertStatus(422);

        // Scheduling it again moves the dates rather than opening a second round.
        $this->actingAs($admin, 'sanctum')->postJson('/api/urf/report-windows', [
            'session' => (int) now()->year,
            'type' => 'half_yearly',
            'opens_on' => now()->subDay()->toDateString(),
            'closes_on' => now()->addWeek()->toDateString(),
            'notes' => 'Two pages at most.',
        ])->assertCreated();
        $this->assertSame(1, UrfReportWindow::for((int) now()->year, 'half_yearly')->count());

        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/reports", $file())->assertCreated();

        // And the round reaches the student's own page.
        $this->actingAs($student, 'sanctum')->getJson('/api/urf/mine')
            ->assertOk()
            ->assertJsonPath('report_windows.0.is_open', true)
            ->assertJsonPath('report_windows.0.notes', 'Two pages at most.');

        // Only the office schedules them.
        $this->actingAs($student, 'sanctum')->getJson('/api/urf/report-windows')->assertForbidden();
        $this->actingAs($student, 'sanctum')->postJson('/api/urf/report-windows', [
            'session' => (int) now()->year,
            'type' => 'final',
            'opens_on' => now()->toDateString(),
            'closes_on' => now()->addWeek()->toDateString(),
        ])->assertForbidden();
    }

    /**
     * A form the student has submitted is with the chain, so it is read rather
     * than filled in until a step sends it back. Every one of the three the
     * student files used to take a second submit: the application and the
     * stipend details silently rewrote an answered form and started the
     * reading again, and a report filed a duplicate row beside the first.
     */
    public function test_a_submitted_form_is_not_edited_again_until_it_is_sent_back(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);

        $department = Department::create(['name' => 'Lock Test Department', 'code' => 'LCKTD']);
        $branch = UgBranch::create([
            'programme' => 'BE',
            'code' => 'LCKTB',
            'name' => 'Lock Test Branch',
            'department_id' => $department->id,
        ]);

        $mentor = $this->faculty(990151, $department);
        $adordcFaculty = $this->faculty(990152, $department);
        $adordc = $adordcFaculty->user;
        $adordc->forceFill(['current_role_id' => Role::where('role', 'adordc')->value('id')])->save();
        $department->adordc_id = $adordcFaculty->faculty_code;
        $department->save();
        $dordc = $this->userAs('dordc');

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $form = [
            'project_title' => 'Lock project ' . Str::random(4),
            'student1_name' => 'Lock Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Male',
            'student1_email' => $student->email,
            'student1_phone' => '9800000016',
            'mentor1_faculty_code' => $mentor->faculty_code,
        ];
        $pdf = fn (string $name) => UploadedFile::fake()->create($name, 10, 'application/pdf');

        $id = $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['proposal' => $pdf('proposal.pdf')])
            ->assertCreated()->json('id');

        // The application is with the mentor, so the student does not rewrite it.
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['project_title' => 'Rewritten behind the mentor'])
            ->assertStatus(422);
        $this->assertSame('mentor', UrfApplication::find($id)->stage, 'the refusal left the form where it was');

        $decide = fn (User $actor, string $formName, $formId, array $body) => $this->actingAs($actor, 'sanctum')
            ->postJson("/api/urf/{$formName}/{$formId}/decision", $body);

        // Sent back, it is theirs again.
        $decide($mentor->user, 'urf-application', $id, ['decision' => 'send_back', 'comments' => 'Say more.'])->assertOk();
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['project_title' => 'Lock project, fuller'])
            ->assertOk();

        $decide($mentor->user, 'urf-application', $id, ['decision' => 'approve'])->assertOk();
        $decide($adordc, 'urf-application', $id, ['decision' => 'approve'])->assertOk();
        $decide($dordc, 'urf-application', $id, ['decision' => 'approve'])->assertOk();
        $this->assertSame('selected', UrfApplication::find($id)->status);

        $details = [
            'full_name' => 'Lock Student', 'dob' => '2004-03-04', 'gender' => 'Male', 'father_name' => 'A Parent',
            'pan' => 'ABCDE1234F', 'aadhaar' => '123456789012', 'bank_name' => 'SBI',
            'account_no' => '123456789012', 'ifsc' => 'SBIN0001234',
        ];
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/fellow", $details)->assertOk();

        $fellowId = DB::table('urf_fellows')->where('urf_application_id', $id)->value('id');
        $decide($mentor->user, 'urf-additional-info', $fellowId, ['decision' => 'approve'])->assertOk();

        // An answered form is not rewritten, and the answer stands.
        $this->actingAs($student, 'sanctum')
            ->postJson("/api/urf/{$id}/fellow", $details + ['bank_name' => 'Another bank'])
            ->assertStatus(422);
        $this->assertSame('adordc', DB::table('urf_fellows')->where('id', $fellowId)->value('stage'));

        $decide($adordc, 'urf-additional-info', $fellowId, ['decision' => 'send_back', 'comments' => 'Wrong IFSC.'])->assertOk();
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/fellow", $details)->assertOk();
        $this->assertSame(1, DB::table('urf_fellows')->where('urf_application_id', $id)->count(), 'corrected, not filed twice');

        // The same for a report, which used to slip past the lock as a new row.
        $this->actingAs($admin, 'sanctum')->postJson('/api/urf/report-windows', [
            'session' => (int) now()->year,
            'type' => 'half_yearly',
            'opens_on' => now()->subDay()->toDateString(),
            'closes_on' => now()->addWeek()->toDateString(),
        ])->assertCreated();

        $report = fn (string $name) => ['type' => 'half_yearly', 'report' => $pdf($name)];
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/reports", $report('first.pdf'))->assertCreated();
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/reports", $report('second.pdf'))->assertStatus(422);
        $this->assertSame(
            1,
            DB::table('urf_reports')->where('urf_application_id', $id)->where('type', 'half_yearly')->count(),
            'the round holds one report, not a duplicate'
        );

        $reportId = DB::table('urf_reports')->where('urf_application_id', $id)->value('id');
        $decide($mentor->user, 'urf-half-yearly-report', $reportId, ['decision' => 'send_back', 'comments' => 'Add the results.'])->assertOk();
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/reports", $report('third.pdf'))->assertCreated();
        $this->assertSame(
            1,
            DB::table('urf_reports')->where('urf_application_id', $id)->where('type', 'half_yearly')->count(),
            'a report sent back is replaced'
        );
    }

    /**
     * A mentor browses the forms of the projects they mentor, as they already
     * browse the projects themselves. The lists and the session picker were the
     * office's alone, so a mentor could open a form by link but never find one,
     * and their page came up with no years to choose from.
     */
    public function test_a_mentor_browses_the_forms_of_the_projects_they_mentor(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Scope Test Department', 'code' => 'SCPTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'SCPTB', 'name' => 'Scope Test Branch', 'department_id' => $department->id]);

        // The UG Students tab lists ug_students rows, which an application does
        // not create: the office adds them, or sign-up does.
        $student->ugStudent()->create([
            'roll_no' => '10230' . random_int(1000, 9999),
            'branch_id' => $branch->id,
            'year' => 3,
        ]);

        $mentor = $this->faculty(990161, $department);
        $stranger = $this->faculty(990162, $department);
        foreach ([$mentor, $stranger] as $faculty) {
            DB::table('roles')->where('id', $faculty->user->role_id)->update(['can_read_urf_mentees' => 'true']);
        }

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $title = 'Scope project ' . Str::random(4);
        $id = $this->actingAs($student, 'sanctum')->postJson('/api/urf', [
            'project_title' => $title,
            'student1_name' => 'Scope Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 3,
            'student1_gender' => 'Female',
            'student1_email' => $student->email,
            'student1_phone' => '9800000017',
            'mentor1_faculty_code' => $mentor->faculty_code,
            'proposal' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf'),
        ])->assertCreated()->json('id');

        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'selected'])->assertOk();
        $this->actingAs($student, 'sanctum')->postJson("/api/urf/{$id}/fellow", [
            'full_name' => 'Scope Student', 'dob' => '2004-05-06', 'gender' => 'Female', 'father_name' => 'A Parent',
            'pan' => 'ABCDE4321F', 'aadhaar' => '210987654321', 'bank_name' => 'SBI',
            'account_no' => '210987654321', 'ifsc' => 'SBIN0004321',
        ])->assertOk();

        // The mentor finds it by browsing, not only by following a link.
        $this->actingAs($mentor->user, 'sanctum')->getJson('/api/urf/urf-additional-info')
            ->assertOk()
            ->assertJsonFragment(['project_title' => $title]);

        // A faculty member who mentors nothing on it reads an empty list rather
        // than a refusal: the page is theirs, the rows are not.
        $this->actingAs($stranger->user, 'sanctum')->getJson('/api/urf/urf-additional-info')
            ->assertOk()
            ->assertJsonMissing(['project_title' => $title]);

        // The years on the picker are the years they mentor in.
        $this->actingAs($mentor->user, 'sanctum')->getJson('/api/urf/sessions')
            ->assertOk()
            ->assertJsonFragment([(int) now()->year]);
        $this->actingAs($stranger->user, 'sanctum')->getJson('/api/urf/sessions')
            ->assertOk()
            ->assertExactJson([]);

        // And the rounds a report was due in, which a report is read against.
        $this->actingAs($mentor->user, 'sanctum')->getJson('/api/urf/report-windows')->assertOk();

        // Scheduling one is still the office's.
        $this->actingAs($mentor->user, 'sanctum')->postJson('/api/urf/report-windows', [
            'session' => (int) now()->year,
            'type' => 'final',
            'opens_on' => now()->toDateString(),
            'closes_on' => now()->addWeek()->toDateString(),
        ])->assertForbidden();

        // A student of the project holds a step on its forms but does not browse
        // the office's lists.
        $this->actingAs($student, 'sanctum')->getJson('/api/urf/urf-additional-info')->assertForbidden();

        // The UG Students tab on /students is the same read: their students,
        // not every student, and not a refusal.
        $this->actingAs($mentor->user, 'sanctum')->getJson('/api/ug-students')
            ->assertOk()
            ->assertJsonFragment(['email' => $student->email]);
        $this->actingAs($stranger->user, 'sanctum')->getJson('/api/ug-students')
            ->assertOk()
            ->assertJsonMissing(['email' => $student->email]);

        // Adding, importing and editing one stay the office's.
        $this->actingAs($mentor->user, 'sanctum')->postJson('/api/ug-students', [])->assertForbidden();
        $this->actingAs($mentor->user, 'sanctum')->postJson('/api/ug-students/import', [])->assertForbidden();
        $this->actingAs($mentor->user, 'sanctum')
            ->patchJson("/api/ug-students/{$student->id}", [])->assertForbidden();
    }

    /**
     * How to reach a UG student stays theirs to correct. Who they are does not:
     * the roll number identifies them across imports and the branch is what
     * routes a form to an ADORDC, so a project freezes those.
     */
    public function test_a_ug_student_corrects_their_contact_details_after_applying(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Details Test Department', 'code' => 'DTLTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'DTLTB', 'name' => 'Details Test Branch', 'department_id' => $department->id]);
        $other = UgBranch::create(['programme' => 'BE', 'code' => 'DTLTC', 'name' => 'Other Test Branch', 'department_id' => $department->id]);
        $mentor = $this->faculty(990171, $department);

        $roll = '10230' . random_int(1000, 9999);
        $record = $student->ugStudent()->create(['roll_no' => $roll, 'branch_id' => $branch->id, 'year' => 2]);

        $details = fn (array $overrides = []) => array_merge([
            'phone' => '9800000018',
            'gender' => 'Female',
            'roll_no' => $roll,
            'branch_id' => $branch->id,
            'year' => 2,
        ], $overrides);

        // Before applying, the whole card is theirs.
        $this->actingAs($student, 'sanctum')
            ->patchJson('/api/urf/me', $details(['year' => 3]))
            ->assertOk();
        $this->assertSame(3, $record->fresh()->year);

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();
        $this->actingAs($student, 'sanctum')->postJson('/api/urf', [
            'project_title' => 'Details project ' . Str::random(4),
            'student1_name' => 'Details Student',
            'student1_roll_no' => $roll,
            'student1_branch_id' => $branch->id,
            'student1_year' => 3,
            'student1_gender' => 'Female',
            'student1_email' => $student->email,
            'student1_phone' => '9800000018',
            'mentor1_faculty_code' => $mentor->faculty_code,
            'proposal' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf'),
        ])->assertCreated();

        // With a project, the contact details still save.
        $this->actingAs($student, 'sanctum')
            ->patchJson('/api/urf/me', ['phone' => '9800000019', 'gender' => 'Male'])
            ->assertOk();
        $student->refresh();
        $this->assertSame('9800000019', $student->phone);
        $this->assertSame('Male', $student->gender);

        // And the rest is ignored rather than written, even if a stale page
        // posts it: the branch is what routes a form to an ADORDC.
        $this->actingAs($student, 'sanctum')
            ->patchJson('/api/urf/me', $details([
                'roll_no' => '999999999',
                'branch_id' => $other->id,
                'year' => 1,
            ]))
            ->assertOk();

        $record->refresh();
        $this->assertSame($roll, $record->roll_no, 'the roll number is the office\'s now');
        $this->assertSame($branch->id, $record->branch_id, 'and so is the branch that routes the form');
        $this->assertSame(3, $record->year);
    }

    /**
     * Closing applications stops new ones. A form a step has sent back is not a
     * new one: it was filed while the window was open, and it sits on the
     * student only because somebody asked them to fix it.
     */
    public function test_a_sent_back_application_is_corrected_after_applications_close(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $fresh = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Closed Test Department', 'code' => 'CLSTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'CLSTB', 'name' => 'Closed Test Branch', 'department_id' => $department->id]);
        $mentor = $this->faculty(990181, $department);

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $form = [
            'project_title' => 'Closed window project ' . Str::random(4),
            'student1_name' => 'Closed Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 2,
            'student1_gender' => 'Male',
            'student1_email' => $student->email,
            'student1_phone' => '9800000020',
            'mentor1_faculty_code' => $mentor->faculty_code,
        ];

        $id = $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['proposal' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf')])
            ->assertCreated()->json('id');

        $this->actingAs($mentor->user, 'sanctum')
            ->postJson("/api/urf/urf-application/{$id}/decision", ['decision' => 'send_back', 'comments' => 'Narrow it.'])
            ->assertOk();

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 0])->assertOk();

        // The correction goes through, and starts the reading again.
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['project_title' => 'Closed window project, narrower'])
            ->assertOk();
        $this->assertSame('mentor', UrfApplication::find($id)->stage);

        // A student who never applied still cannot start one.
        $this->actingAs($fresh, 'sanctum')
            ->postJson('/api/urf', $form + [
                'student1_email' => $fresh->email,
                'student1_roll_no' => '10230' . random_int(1000, 9999),
                'student1_phone' => '9800000021',
                'proposal' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf'),
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'URF applications are closed');

        // And the one now back with the mentor is not rewritten either.
        $this->actingAs($student, 'sanctum')
            ->postJson('/api/urf', $form + ['project_title' => 'Rewritten behind the mentor'])
            ->assertStatus(422);
    }

    /**
     * One round runs at a time, so a fellow is never asked for two reports at
     * once. Checked across sessions as well: a session is a calendar year and
     * its rounds run inside it, so last year's final can reach into this
     * year's first round.
     */
    public function test_only_one_report_round_runs_at_a_time(): void
    {
        $admin = $this->userAs('admin', ['can_manage_urf' => 'true']);
        $year = (int) now()->year;

        $round = fn (array $body) => $this->actingAs($admin, 'sanctum')
            ->postJson('/api/urf/report-windows', $body);

        $round([
            'session' => $year,
            'type' => 'half_yearly',
            'opens_on' => "{$year}-06-01",
            'closes_on' => "{$year}-09-30",
        ])->assertCreated();

        // Back to back is fine; the day after one closes is free.
        $round([
            'session' => $year,
            'type' => 'final',
            'opens_on' => "{$year}-10-01",
            'closes_on' => "{$year}-12-31",
        ])->assertCreated();

        // Reaching back into the half-yearly round is not.
        $round([
            'session' => $year,
            'type' => 'final',
            'opens_on' => "{$year}-09-15",
            'closes_on' => "{$year}-12-31",
        ])->assertStatus(422)
            ->assertJsonPath('message', 'One round runs at a time, and that overlaps the Half-yearly Progress Report round for URF '
                . $year . ', which runs 01 Jun ' . $year . ' to 30 Sep ' . $year . '.');

        // Nor does the next session get to start inside this one.
        $next = $year + 1;
        $round([
            'session' => $next,
            'type' => 'half_yearly',
            'opens_on' => "{$year}-12-15",
            'closes_on' => "{$next}-03-31",
        ])->assertStatus(422);

        // Moving a round's own dates is not a clash with itself.
        $round([
            'session' => $year,
            'type' => 'final',
            'opens_on' => "{$year}-10-15",
            'closes_on' => "{$next}-01-31",
        ])->assertCreated();

        $this->assertSame(2, UrfReportWindow::where('session', $year)->count(), 'moved, not added');
    }

    public function test_each_reader_sees_only_what_waits_on_them(): void
    {
        Storage::fake('public');

        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $student = $this->userAs('ug_student', ['can_apply_for_urf' => 'true']);
        $department = Department::create(['name' => 'Queue Test Department', 'code' => 'QUETD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'QUETB', 'name' => 'Queue Test Branch', 'department_id' => $department->id]);
        $mentor = $this->faculty(990111, $department);
        $stranger = $this->faculty(990112, $department);

        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();

        $title = 'Queue project ' . Str::random(4);
        $this->actingAs($student, 'sanctum')->postJson('/api/urf', [
            'project_title' => $title,
            'student1_name' => 'Queue Student',
            'student1_roll_no' => '10230' . random_int(1000, 9999),
            'student1_branch_id' => $branch->id,
            'student1_year' => 3,
            'student1_gender' => 'Female',
            'student1_email' => $student->email,
            'student1_phone' => '9800000012',
            'mentor1_faculty_code' => $mentor->faculty_code,
            'proposal' => UploadedFile::fake()->create('proposal.pdf', 10, 'application/pdf'),
        ])->assertCreated();

        $this->actingAs($mentor->user, 'sanctum')->getJson('/api/urf/queue')
            ->assertOk()
            ->assertJsonFragment(['project_title' => $title, 'form' => 'urf-application']);

        $this->actingAs($stranger->user, 'sanctum')->getJson('/api/urf/queue')
            ->assertOk()
            ->assertJsonMissing(['project_title' => $title]);
    }
}
