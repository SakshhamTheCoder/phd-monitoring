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
