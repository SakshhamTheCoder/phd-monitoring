<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\UgBranch;
use App\Models\UrfApplication;
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
        $decide($adordc, ['approval' => true])->assertStatus(403);
        $decide($dordc, ['approval' => true])->assertStatus(403);

        // A rejection has to say what to fix.
        $decide($mentor->user, ['approval' => false])->assertStatus(422);

        $decide($mentor->user, ['approval' => false, 'comments' => 'Narrow the scope.'])->assertOk();
        $application->refresh();
        $this->assertSame('student', $application->stage, 'it goes back to the student');
        $this->assertSame('Narrow the scope.', $application->mentor_comments);
        $this->assertSame('applied', $application->status);

        // Correcting it starts the reading again.
        $this->actingAs($student, 'sanctum')->postJson('/api/urf', $form + ['project_title' => 'Chain project, narrower'])->assertOk();
        $application->refresh();
        $this->assertSame('mentor', $application->stage);
        $this->assertFalse((bool) $application->mentor_approval, 'the old answer is spent');

        $decide($mentor->user, ['approval' => true])->assertOk()->assertJsonPath('stage', 'adordc');
        $decide($mentor->user, ['approval' => true])->assertStatus(403);
        $decide($adordc, ['approval' => true])->assertOk()->assertJsonPath('stage', 'dordc');

        // The last approval is the project being selected.
        $decide($dordc, ['approval' => true])
            ->assertOk()
            ->assertJsonPath('stage', 'complete')
            ->assertJsonPath('status', 'selected');

        $application->refresh();
        $this->assertSame('selected', $application->status);
        // Filed, sent back, corrected, then read three times.
        $this->assertCount(6, $application->history, 'every hop is on the record');

        // And nothing more is read on a form that is through.
        $decide($dordc, ['approval' => true])->assertStatus(422);
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
