<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\UgBranch;
use App\Models\Faculty;
use App\Models\Notifications;
use App\Models\Role;
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
 * One URF project from application to report: the window, the second student
 * reaching the project by email, the admin list and stages, stipend details
 * kept private and encrypted, and publications filed against the project.
 */
class UrfFlowTest extends TestCase
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
            'first_name' => 'Urf',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@urf.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    public function test_a_project_moves_from_application_to_report(): void
    {
        Storage::fake('public');
        $admin = $this->userAs('admin', ['can_manage_urf' => 'true', 'can_manage_app_settings' => 'true']);
        $applicant = $this->userAs('ug_student');
        $partner = $this->userAs('ug_student');
        $outsider = $this->userAs('ug_student');

        $department = Department::create(['name' => 'URF Test Department', 'code' => 'URFTD']);
        $branch = UgBranch::create(['programme' => 'BE', 'code' => 'URFTB', 'name' => 'URF Test Branch']);
        $mentor = Faculty::create([
            'faculty_code' => 990001,
            'user_id' => $this->userAs('faculty')->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);

        $form = [
            'project_title' => 'Soil sensors ' . Str::random(4),
            'student1_name' => 'Asha Rao', 'student1_roll_no' => '102203001', 'student1_branch_id' => $branch->id, 'student1_year' => 3,
            'student1_gender' => 'Female', 'student1_email' => $applicant->email, 'student1_phone' => '9800000001',
            'student2_name' => 'Ravi Kumar', 'student2_roll_no' => '102203002', 'student2_branch_id' => $branch->id, 'student2_year' => 2,
            'student2_gender' => 'Male', 'student2_email' => $partner->email, 'student2_phone' => '9800000002',
            'mentor1_faculty_code' => $mentor->faculty_code,
        ];
        $proposal = fn () => UploadedFile::fake()->create('proposal.pdf', 10, 'application/pdf');

        // The window is shut until the admin opens it.
        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 0])->assertOk();
        $this->actingAs($applicant, 'sanctum')->postJson('/api/urf', $form + ['proposal' => $proposal()])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();
        $this->actingAs($applicant, 'sanctum')->getJson('/api/urf/branches')->assertOk()->assertJsonFragment(['id' => $branch->id]);

        $id = $this->actingAs($applicant, 'sanctum')->postJson('/api/urf', $form + ['proposal' => $proposal()])
            ->assertCreated()->json('id');

        // The second student finds the project by email but cannot rewrite it.
        $this->actingAs($partner, 'sanctum')->getJson('/api/urf/mine')->assertOk()->assertJsonPath('applications.0.id', $id)->assertJsonPath('session', (int) now()->year);
        $this->actingAs($partner, 'sanctum')->postJson('/api/urf', $form)->assertForbidden();
        $this->actingAs($outsider, 'sanctum')->getJson('/api/urf/mine')->assertOk()->assertJsonCount(0, 'applications');
        $this->actingAs($outsider, 'sanctum')->getJson("/api/urf/{$id}")->assertForbidden();
        $this->actingAs($outsider, 'sanctum')->getJson('/api/publications')->assertOk()->assertJsonCount(0, 'international');

        // The admin list filters by stage and by the filter bar's conditions.
        $filters = fn (array $f) => '/api/urf?filters=' . urlencode(json_encode($f));
        $this->actingAs($admin, 'sanctum')
            ->getJson($filters(['conditions' => [['key' => 'student1_roll_no|student2_roll_no', 'op' => '=', 'value' => '102203001']], 'mandatory_filter' => [['key' => 'status', 'op' => '=', 'value' => 'applied']]]))
            ->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.session', (int) now()->year);
        $this->getJson($filters(['conditions' => [], 'mandatory_filter' => [['key' => 'status', 'op' => '=', 'value' => 'rejected']]]))
            ->assertOk()->assertJsonMissing(['id' => $id]);

        // Stipend details and reports both wait for the project to be selected,
        // which is the one decision there is besides rejecting it.
        // A report also waits on its round, which the office opens.
        foreach (['half_yearly', 'final'] as $type) {
            UrfReportWindow::create([
                'session' => (int) now()->year,
                'type' => $type,
                'opens_on' => now()->subDay()->toDateString(),
                'closes_on' => now()->addMonth()->toDateString(),
            ]);
        }
        $report = ['type' => 'half_yearly', 'conference_presentation' => 'Poster at ICSS', 'report' => UploadedFile::fake()->create('r.pdf', 10, 'application/pdf')];
        $this->actingAs($applicant, 'sanctum')->postJson("/api/urf/{$id}/reports", $report)->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'ongoing'])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'selected'])->assertOk();

        // Both students hear of each open round once, however often it runs.
        $roundNotices = fn () => Notifications::whereIn('user_id', [$applicant->id, $partner->id])
            ->where('link', 'like', '/forms?urf_round=%')->count();
        $this->artisan('urf:announce-report-rounds')->assertSuccessful();
        $this->assertSame(4, $roundNotices());
        $this->artisan('urf:announce-report-rounds')->assertSuccessful();
        $this->assertSame(4, $roundNotices());
        $this->actingAs($partner, 'sanctum')->postJson("/api/urf/{$id}/fellow", [
            'full_name' => 'Ravi Kumar', 'dob' => '2004-05-06', 'gender' => 'Male', 'father_name' => 'Mohan Kumar',
            'pan' => 'abcde1234f', 'aadhaar' => '1234 5678 9012', 'bank_name' => 'SBI', 'account_no' => '123456789012', 'ifsc' => 'sbin0001234',
        ])->assertOk();
        $this->assertNotSame('ABCDE1234F', DB::table('urf_fellows')->where('user_id', $partner->id)->value('pan'));

        $this->actingAs($applicant, 'sanctum')->postJson("/api/urf/{$id}/reports", $report)->assertCreated();

        // A publication belongs to the student who added it, not to the project.
        $this->actingAs($applicant, 'sanctum')->postJson('/api/publications', [
            'title' => 'Low-cost soil sensing', 'publication_type' => 'conference', 'authors' => 'A. Rao, R. Kumar',
            'status' => 'accepted', 'doi_link' => 'https://doi.org/10.1/x', 'year' => '2026', 'name' => 'ICSS',
            'country' => 'India', 'state' => 'Punjab', 'city' => 'Patiala', 'type' => 'international',
            'mode' => 'online', 'funding' => 'TIET seed grant',
            'first_page' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf'),
        ])->assertCreated();
        $this->getJson('/api/publications')->assertOk()->assertJsonPath('international.0.mode', 'online');
        $this->actingAs($partner, 'sanctum')->getJson('/api/publications')->assertOk()->assertJsonCount(0, 'international');

        // The final report links it from the library, as a PhD progress form does.
        $publicationId = $this->actingAs($applicant, 'sanctum')->getJson('/api/publications')->json('international.0.id');
        $this->actingAs($applicant, 'sanctum')->postJson("/api/urf/{$id}/reports", [
            'type' => 'final',
            'publications' => json_encode([$publicationId]),
            'report' => UploadedFile::fake()->create('f.pdf', 10, 'application/pdf'),
        ])->assertCreated();
        $this->getJson('/api/publications')->assertJsonCount(1, 'international');

        // The admin sees everything; a student sees only their own stipend details.
        $this->actingAs($admin, 'sanctum')->getJson("/api/urf/{$id}")->assertOk()
            ->assertJsonPath('fellows.0.pan', 'ABCDE1234F')
            ->assertJsonCount(2, 'reports')
            ->assertJsonPath('reports.1.publications.international.0.funding', 'TIET seed grant')
            ->assertJsonCount(0, 'reports.0.publications.international')
            ->assertJsonMissingPath('publications');
        $this->getJson('/api/urf?filters=' . urlencode(json_encode(['conditions' => [['key' => 'project_title', 'op' => '=', 'value' => $form['project_title']]]])))
            ->assertJsonPath('data.0.students', 'Asha Rao, Ravi Kumar')
            // Branch and year read as one answer per student.
            ->assertJsonPath('data.0.branch', 'URF Test Branch, 3rd Year · URF Test Branch, 2nd Year');
        $this->actingAs($applicant, 'sanctum')->getJson('/api/urf/mine')->assertOk()->assertJsonCount(0, 'applications.0.fellows');
        $this->actingAs($partner, 'sanctum')->getJson('/api/urf/mine')->assertOk()->assertJsonCount(1, 'applications.0.fellows');
        // Reports too: the applicant filed both, and the partner does not receive them.
        $this->actingAs($applicant, 'sanctum')->getJson('/api/urf/mine')->assertJsonCount(2, 'applications.0.reports');
        $this->actingAs($partner, 'sanctum')->getJson('/api/urf/mine')->assertJsonCount(0, 'applications.0.reports');

        // The admin's forms grid lists each form's submissions against their project.
        $onThisProject = '?filters=' . urlencode(json_encode(['conditions' => [['key' => 'project_title', 'op' => '=', 'value' => $form['project_title']]]]));
        $this->actingAs($admin, 'sanctum')->getJson('/api/urf/urf-additional-info' . $onThisProject)->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.application_id', $id)
            ->assertJsonPath('data.0.branch', 'URF Test Branch, 2nd Year');
        $this->getJson('/api/urf/urf-half-yearly-report' . $onThisProject)->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.application_id', $id)
            ->assertJsonPath('data.0.branch', 'URF Test Branch, 3rd Year');
        $this->getJson('/api/urf/urf-final-report' . $onThisProject)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/urf/urf-application/filters')->assertOk()->assertJsonFragment(['key_name' => 'project_title']);
        $this->actingAs($applicant, 'sanctum')->getJson('/api/urf/urf-final-report')->assertForbidden();

        // A selected student cannot apply twice in one session, but can the next.
        $this->actingAs($applicant, 'sanctum')->postJson('/api/urf', $form + ['proposal' => $proposal()])->assertStatus(422);
        UrfApplication::whereKey($id)->update(['session' => now()->year - 1]);
        $secondTitle = 'Second year ' . Str::random(4);
        $this->postJson('/api/urf', ['project_title' => $secondTitle] + $form + ['proposal' => $proposal()])->assertCreated();
        $this->actingAs($partner, 'sanctum')->getJson('/api/urf/mine')->assertOk()
            ->assertJsonCount(2, 'applications')
            ->assertJsonPath('applications.0.project_title', $secondTitle)
            ->assertJsonPath('applications.1.id', $id);

        // The admin list puts the newest session first, whatever order the
        // applications were made in.
        $secondId = $this->getJson('/api/urf/mine')->json('applications.0.id');
        UrfApplication::whereKey($secondId)->update(['session' => now()->year - 2]);
        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/urf?filters=' . urlencode(json_encode(['conditions' => [['key' => 'student1_roll_no|student2_roll_no', 'op' => '=', 'value' => '102203001']]])))
            ->assertJsonPath('data.0.id', $id)
            ->assertJsonPath('data.1.id', $secondId);

        // A filter on a key the page never offered is ignored, not run: the key
        // arrives from the client, and any column would include password hashes.
        $unoffered = fn (string $key) => '/api/urf?filters=' . urlencode(json_encode(['conditions' => [['key' => $key, 'op' => 'LIKE', 'value' => 'zzzzzzzz']]]));
        $this->actingAs($admin, 'sanctum')->getJson($unoffered('user.password'))
            ->assertOk()->assertJsonFragment(['id' => $id]);
        $this->getJson($unoffered('project_title'))->assertOk()->assertJsonCount(0, 'data');

        // One filter field covers both students and both mentors, so the second
        // student is found by name or roll number, whatever case it is typed in.
        $by = fn (string $key, string $value) => '/api/urf?filters=' . urlencode(json_encode([
            'conditions' => [['key' => $key, 'op' => 'LIKE', 'value' => $value]],
        ]));
        $this->getJson($by('student1_name|student2_name', 'ravi kumar'))->assertOk()->assertJsonFragment(['id' => $id]);
        $this->getJson($by('student1_roll_no|student2_roll_no', '102203002'))->assertOk()->assertJsonFragment(['id' => $id]);
        $this->getJson($by('student1_name|student2_name', 'nobody here'))->assertOk()->assertJsonCount(0, 'data');

        // A mentor searched by full name, as the suggestion list writes it.
        $mentorName = $mentor->user->name();
        $this->getJson($by('mentor1.user.first_name|mentor2.user.first_name', $mentorName))
            ->assertOk()->assertJsonFragment(['id' => $id]);

        // All of a student's publications stay in one library across projects.
        $this->actingAs($applicant, 'sanctum')->getJson('/api/publications')->assertJsonCount(1, 'international');
        $this->actingAs($outsider, 'sanctum')->getJson('/api/publications')->assertJsonCount(0, 'international');

        $this->assertSame('selected', UrfApplication::find($id)->status);

        // A mentor reads the projects they are named on, and only those.
        DB::table('roles')->where('role', 'faculty')->update(['can_read_urf_mentees' => 'true']);
        $mentorAccount = $mentor->user;
        $this->actingAs($mentorAccount, 'sanctum')->getJson('/api/urf')
            ->assertOk()
            ->assertJsonFragment(['id' => $id]);
        $this->actingAs($mentorAccount, 'sanctum')->getJson("/api/urf/{$id}")
            ->assertOk()
            ->assertJsonPath('id', $id)
            // Bank details are the student's own, whoever else is reading.
            ->assertJsonCount(0, 'fellows')
            // The mentor reviews every member's reports.
            ->assertJsonCount(2, 'reports');

        // Another faculty member mentors nothing, so there is nothing to read.
        $stranger = Faculty::create([
            // A code of its own, since the dev database already holds 990002.
            'faculty_code' => 990042,
            'user_id' => $this->userAs('faculty')->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);
        $this->actingAs($stranger->user, 'sanctum')->getJson('/api/urf')->assertOk()->assertJsonCount(0, 'data');
        $this->actingAs($stranger->user, 'sanctum')->getJson("/api/urf/{$id}")->assertForbidden();

        // And the nav item follows the fact, not the role.
        $this->actingAs($mentorAccount, 'sanctum')->getJson('/api/my-roles')
            ->assertJsonPath('capabilities.can_read_urf_mentees', true);
        $this->actingAs($stranger->user, 'sanctum')->getJson('/api/my-roles')
            ->assertJsonPath('capabilities.can_read_urf_mentees', false);
    }
}
