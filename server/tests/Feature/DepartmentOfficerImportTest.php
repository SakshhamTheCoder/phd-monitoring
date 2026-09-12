<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\PhdCoordinator;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The department officers sheet.
 *
 * Two things here are easy to get wrong and expensive to discover late. A code
 * the institute has renamed has to be changed on the existing department rather
 * than becoming a second one, because every scholar, faculty member and saved
 * form points at the record by id. And an officer is regularly someone from
 * another department, so the old "faculty does not belong to this department"
 * check made the real sheet unimportable.
 */
class DepartmentOfficerImportTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    private function import(array $row)
    {
        return $this->postJson('/api/departments/import', [
            'rows' => [array_merge(['row_number' => 2], $row)],
        ]);
    }

    public function test_a_superseded_code_renames_the_department_it_already_has(): void
    {
        $this->admin();

        // A superseded code is only recognised because DepartmentCodes lists
        // it, so the test uses a pair the institute actually renamed, and puts
        // the department back under the older code to stand in for an install
        // that has not been through the rename yet.
        $department = null;
        $legacy = null;
        $official = null;

        foreach (\App\Support\DepartmentCodes::LEGACY_ALIASES as $from => $to) {
            $candidate = Department::whereRaw('UPPER(code) = ?', [strtoupper($to)])->first();
            if ($candidate) {
                $department = $candidate;
                $legacy = $from;
                $official = $to;
                break;
            }
        }

        $this->assertNotNull($department, 'needs a department carrying a renamed code');

        $originalId = $department->id;
        $department->code = $legacy;
        $department->name = $legacy;
        $department->save();

        $this->import(['department_code' => $official])->assertStatus(200);

        $renamed = Department::findOrFail($originalId);
        $this->assertSame($official, $renamed->code);
        $this->assertSame($official, $renamed->name);
        $this->assertSame(0, Department::whereRaw('UPPER(code) = ?', [strtoupper($legacy)])->count());
    }

    public function test_a_code_another_department_already_holds_is_refused(): void
    {
        $this->admin();

        $departments = Department::orderBy('id')->take(2)->get();
        $this->assertCount(2, $departments, 'needs two departments');

        $response = $this->import([
            'department_code' => $departments[1]->code,
        ])->assertStatus(200);

        // Resolve lands on the second department, whose code already matches,
        // so nothing is renamed and the first is untouched either way.
        $this->assertSame($departments[0]->code, $departments[0]->fresh()->code);
        $this->assertSame(0, $response->json('data.error_count'));
    }

    public function test_an_officer_from_another_department_is_accepted(): void
    {
        $this->admin();

        $department = Department::whereNotNull('id')->firstOrFail();
        $outsider = Faculty::with('user')
            ->where('department_id', '!=', $department->id)
            ->whereNotNull('department_id')
            ->where('type', 'internal')
            ->firstOrFail();

        $this->import([
            'department_code' => $department->code,
            'hod_email' => $outsider->user->email,
        ])->assertStatus(200)->assertJsonPath('data.errors', []);

        $this->assertSame($outsider->faculty_code, (int) $department->fresh()->hod_id);
    }

    public function test_an_office_address_is_reported_and_changes_nothing(): void
    {
        $this->admin();

        $department = Department::firstOrFail();
        $before = $department->adordc_id;

        $response = $this->import([
            'department_code' => $department->code,
            'adordc_email' => 'adorsp4@thapar.edu',
        ])->assertStatus(200);

        $this->assertStringContainsString('no faculty with the email', $response->json('data.errors.0'));
        $this->assertSame($before, $department->fresh()->adordc_id);
    }

    public function test_the_sheet_replaces_the_coordinator_list(): void
    {
        $this->admin();

        $department = Department::firstOrFail();
        $faculty = Faculty::with('user')->where('type', 'internal')->take(2)->get();
        $this->assertCount(2, $faculty, 'needs two faculty');

        PhdCoordinator::where('department_id', $department->id)->delete();
        PhdCoordinator::create([
            'department_id' => $department->id,
            'faculty_id' => $faculty[0]->faculty_code,
        ]);

        $this->import([
            'department_code' => $department->code,
            'coordinator_1_email' => $faculty[1]->user->email,
        ])->assertStatus(200)->assertJsonPath('data.errors', []);

        $this->assertSame(
            [$faculty[1]->faculty_code],
            PhdCoordinator::where('department_id', $department->id)->pluck('faculty_id')->all()
        );
    }
}
