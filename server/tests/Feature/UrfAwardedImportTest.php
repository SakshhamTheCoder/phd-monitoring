<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\UgBranch;
use App\Models\UrfApplication;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Onboarding projects that were awarded before the portal existed.
 *
 * The part worth pinning is what the import refuses and what it does not
 * pretend. A project with no mentor has nobody to approve its reports, and an
 * imported approval would be a reading nobody did, so neither is allowed to
 * pass quietly.
 */
class UrfAwardedImportTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private UgBranch $branch;
    private User $office;
    private Faculty $mentor;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'URFT'],
            ['name' => 'URF Import Test Department']
        );

        $this->branch = UgBranch::firstOrCreate(
            ['programme' => 'BE', 'code' => 'URFC'],
            ['name' => 'URF Test Branch', 'department_id' => $this->department->id]
        );

        $this->office = $this->userAs('admin', ['can_manage_urf' => 'true']);
        $this->mentor = $this->facultyFor($this->userAs('faculty'), 993001);
    }

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
            'email' => Str::lower(Str::random(10)) . '@awarded.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function facultyFor(User $user, int $code): Faculty
    {
        return Faculty::create([
            'faculty_code' => $code,
            'user_id' => $user->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);
    }

    private function row(array $overrides = []): array
    {
        return array_merge([
            '_rowNumber' => 2,
            'project_title' => 'Low power sensing for field robots',
            'session' => 2026,
            'student1_name' => 'Student One',
            'student1_roll_no' => '102203001',
            'student1_email' => 'awarded.one@thapar.test',
            'student1_phone' => '9800000001',
            'student1_gender' => 'Female',
            'student1_year' => 3,
            'student1_branch_code' => 'URFC',
            'mentor1_email' => $this->mentor->user->email,
        ], $overrides);
    }

    private function import(array $rows)
    {
        return $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/urf/import-awarded', ['rows' => $rows]);
    }

    public function test_an_awarded_project_arrives_selected_and_settled(): void
    {
        $this->import([$this->row()])
            ->assertStatus(200)
            ->assertJson(['added' => 1, 'updated' => 0, 'errors' => []]);

        $application = UrfApplication::where('student1_email', 'awarded.one@thapar.test')->first();

        $this->assertNotNull($application);
        $this->assertSame('selected', $application->status);
        $this->assertSame('complete', $application->stage, 'an awarded project is not waiting on anybody');
        $this->assertSame($this->mentor->faculty_code, (int) $application->mentor1_faculty_code);
        $this->assertNull($application->proposal, 'the proposal was filed outside the portal');
    }

    public function test_the_history_says_the_decision_was_taken_elsewhere(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        $history = UrfApplication::where('student1_email', 'awarded.one@thapar.test')->first()->history;

        $this->assertNotEmpty($history);
        $entry = end($history);
        $this->assertSame('office', $entry['step']);
        $this->assertStringContainsString('awarded projects sheet', $entry['comments']);

        // Nothing claims a mentor or an ADORDC read it, because neither did.
        $steps = array_column($history, 'step');
        $this->assertNotContains('mentor', $steps);
        $this->assertNotContains('adordc', $steps);
    }

    public function test_a_student_with_no_account_gets_one(): void
    {
        $this->assertNull(User::where('email', 'awarded.one@thapar.test')->first());

        $this->import([$this->row()])->assertStatus(200);

        $account = User::where('email', 'awarded.one@thapar.test')->first();
        $this->assertNotNull($account);
        $this->assertSame('102203001', $account->ugStudent->roll_no);
        $this->assertSame($this->branch->id, $account->ugStudent->branch_id);
    }

    public function test_a_mentor_the_portal_does_not_know_names_the_row(): void
    {
        $response = $this->import([$this->row(['mentor1_email' => 'nobody@elsewhere.test'])])
            ->assertStatus(200);

        $this->assertSame(0, $response->json('added'));
        $this->assertStringContainsString('nobody@elsewhere.test', $response->json('errors.0'));
        $this->assertSame(0, UrfApplication::where('project_title', 'Low power sensing for field robots')->count());
    }

    public function test_a_new_student_without_a_branch_code_names_the_row(): void
    {
        $response = $this->import([$this->row(['student1_branch_code' => ''])])
            ->assertStatus(200);

        $this->assertSame(0, $response->json('added'));
        $this->assertStringContainsString('branch code', $response->json('errors.0'));
    }

    public function test_the_same_file_twice_updates_rather_than_duplicates(): void
    {
        $this->import([$this->row()])->assertStatus(200);
        $this->import([$this->row(['project_title' => 'A corrected title'])])
            ->assertStatus(200)
            ->assertJson(['added' => 0, 'updated' => 1]);

        $applications = UrfApplication::where('student1_email', 'awarded.one@thapar.test')->get();
        $this->assertCount(1, $applications);
        $this->assertSame('A corrected title', $applications->first()->project_title);
    }

    public function test_only_the_office_may_import(): void
    {
        $this->actingAs($this->userAs('student'), 'sanctum')
            ->postJson('/api/urf/import-awarded', ['rows' => [$this->row()]])
            ->assertStatus(403);
    }
}
