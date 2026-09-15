<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\UrfApplication;
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
        $mentor = Faculty::create([
            'faculty_code' => 990001,
            'user_id' => $this->userAs('faculty')->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
            'type' => 'internal',
        ]);

        $form = [
            'project_title' => 'Soil sensors ' . Str::random(4),
            'student1_name' => 'Asha Rao', 'student1_roll_no' => '102203001', 'student1_department_id' => $department->id, 'student1_year' => 3,
            'student1_gender' => 'Female', 'student1_email' => $applicant->email, 'student1_phone' => '9800000001',
            'student2_name' => 'Ravi Kumar', 'student2_roll_no' => '102203002', 'student2_department_id' => $department->id, 'student2_year' => 2,
            'student2_gender' => 'Male', 'student2_email' => $partner->email, 'student2_phone' => '9800000002',
            'mentor1_faculty_code' => $mentor->faculty_code,
        ];
        $proposal = fn () => UploadedFile::fake()->create('proposal.pdf', 10, 'application/pdf');

        // The window is shut until the admin opens it.
        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 0])->assertOk();
        $this->actingAs($applicant, 'sanctum')->postJson('/api/urf', $form + ['proposal' => $proposal()])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->postJson('/api/settings/urf', ['applications_open' => 1])->assertOk();
        $this->actingAs($applicant, 'sanctum')->getJson('/api/urf/departments')->assertOk()->assertJsonFragment(['id' => $department->id]);

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
            ->getJson($filters(['conditions' => [['key' => 'student1_roll_no', 'op' => '=', 'value' => '102203001']], 'mandatory_filter' => [['key' => 'status', 'op' => '=', 'value' => 'applied']]]))
            ->assertOk()->assertJsonPath('data.0.id', $id)->assertJsonPath('data.0.session', (int) now()->year);
        $this->getJson($filters(['conditions' => [], 'mandatory_filter' => [['key' => 'status', 'op' => '=', 'value' => 'rejected']]]))
            ->assertOk()->assertJsonMissing(['id' => $id]);

        // Stipend details and reports both wait for the project to be selected,
        // which is the one decision there is besides rejecting it.
        $report = ['type' => 'half_yearly', 'conference_presentation' => 'Poster at ICSS', 'report' => UploadedFile::fake()->create('r.pdf', 10, 'application/pdf')];
        $this->actingAs($applicant, 'sanctum')->postJson("/api/urf/{$id}/reports", $report)->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'ongoing'])->assertStatus(422);
        $this->actingAs($admin, 'sanctum')->postJson("/api/urf/{$id}/status", ['status' => 'selected'])->assertOk();
        $this->actingAs($partner, 'sanctum')->postJson("/api/urf/{$id}/fellow", [
            'full_name' => 'Ravi Kumar', 'dob' => '2004-05-06', 'gender' => 'Male', 'father_name' => 'Mohan Kumar',
            'pan' => 'abcde1234f', 'aadhaar' => '1234 5678 9012', 'bank_name' => 'SBI', 'account_no' => '123456789012', 'ifsc' => 'sbin0001234',
        ])->assertOk();
        $this->assertNotSame('ABCDE1234F', DB::table('urf_fellows')->where('user_id', $partner->id)->value('pan'));

        $this->actingAs($applicant, 'sanctum')->postJson("/api/urf/{$id}/reports", $report)->assertCreated();

        // A publication belongs to the project, so both students see it.
        $this->actingAs($applicant, 'sanctum')->postJson('/api/publications', [
            'title' => 'Low-cost soil sensing', 'publication_type' => 'conference', 'authors' => 'A. Rao, R. Kumar',
            'status' => 'accepted', 'doi_link' => 'https://doi.org/10.1/x', 'year' => '2026', 'name' => 'ICSS',
            'country' => 'India', 'state' => 'Punjab', 'city' => 'Patiala', 'type' => 'international',
            'mode' => 'online', 'funding' => 'TIET seed grant',
            'first_page' => UploadedFile::fake()->create('p.pdf', 10, 'application/pdf'),
        ])->assertCreated();
        $this->actingAs($partner, 'sanctum')->getJson('/api/publications')->assertOk()
            ->assertJsonPath('international.0.mode', 'online');

        // The final report links it from the library, as a PhD progress form does.
        $publicationId = $this->getJson('/api/publications')->json('international.0.id');
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
            ->assertJsonPath('data.0.roll_no', '102203001, 102203002')
            ->assertJsonPath('data.0.year', '3rd Year, 2nd Year');
        $this->actingAs($applicant, 'sanctum')->getJson('/api/urf/mine')->assertOk()->assertJsonCount(0, 'applications.0.fellows');
        $this->actingAs($partner, 'sanctum')->getJson('/api/urf/mine')->assertOk()->assertJsonCount(1, 'applications.0.fellows');

        // The admin's forms grid lists each form's submissions against their project.
        $onThisProject = '?filters=' . urlencode(json_encode(['conditions' => [['key' => 'project_title', 'op' => '=', 'value' => $form['project_title']]]]));
        $this->actingAs($admin, 'sanctum')->getJson('/api/urf/urf-additional-info' . $onThisProject)->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.application_id', $id)
            ->assertJsonPath('data.0.roll_no', '102203002')
            ->assertJsonPath('data.0.branch', 'URF Test Department')
            ->assertJsonPath('data.0.year', '2nd Year');
        $this->getJson('/api/urf/urf-half-yearly-report' . $onThisProject)->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.application_id', $id)
            ->assertJsonPath('data.0.roll_no', '102203001')
            ->assertJsonPath('data.0.year', '3rd Year');
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
        $newId = $this->getJson('/api/urf/mine')->json('applications.0.id');

        // Each project keeps its own publication library; the latest is the default.
        $this->getJson("/api/publications?urf_application_id={$id}")->assertJsonCount(1, 'international');
        $this->getJson("/api/publications?urf_application_id={$newId}")->assertJsonCount(0, 'international');
        $this->getJson('/api/publications')->assertJsonCount(0, 'international');
        $this->actingAs($outsider, 'sanctum')->getJson("/api/publications?urf_application_id={$id}")->assertJsonCount(0, 'international');

        $this->assertSame('selected', UrfApplication::find($id)->status);
    }
}
