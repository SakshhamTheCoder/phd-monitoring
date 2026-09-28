<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\SupervisorAllocation;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The institute renumbered some staff, so the sheet's employee code and the
 * portal's disagree for a handful of people.
 *
 * The code is the join key nineteen columns point at, and a form or two stores
 * it in a list instead. Moving it has to take all of that with it, or the
 * professor's supervisions vanish and their scholar's allocation form cannot
 * name its own supervisor.
 */
class RenumberingAFacultyKeepsTheirLinksTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $office;
    private Faculty $professor;
    private Student $scholar;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'RNMB'],
            ['name' => 'Renumbering Test Department']
        );

        $this->office = $this->userAs('admin', ['can_manage_faculties' => 'true', 'can_read_all_faculties' => 'true']);
        $this->professor = Faculty::create([
            'faculty_code' => 994100,
            'user_id' => $this->userAs('faculty', [], 'renumber.professor@thapar.test')->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);

        $this->scholar = Student::create([
            'roll_no' => 994101,
            'user_id' => $this->userAs('student')->id,
            'department_id' => $this->department->id,
            'date_of_registration' => '2021-07-01',
            'current_status' => 'full-time',
            'overall_progress' => 0,
        ]);

        DB::table('supervisors')->insert([
            'faculty_id' => 994100,
            'student_id' => 994101,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function userAs(string $role, array $capabilities = [], ?string $email = null): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => 'Renumber',
            'last_name' => Str::random(6),
            'email' => $email ?? Str::lower(Str::random(10)) . '@renumber.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    /** faculty_code is the primary key, so a moved row is not found by fresh(). */
    private function codeOf(int $userId): int
    {
        return (int) Faculty::where('user_id', $userId)->value('faculty_code');
    }

    private function importWithCode(int $facultyCode)
    {
        return $this->actingAs($this->office, 'sanctum')->postJson('/api/faculty/bulk-import', [
            'batch_data' => [[
                'row_number' => 2,
                'faculty_code' => (string) $facultyCode,
                'full_name' => 'Renumber Professor',
                'email' => 'renumber.professor@thapar.test',
                'designation' => 'Professor',
                'department_code' => 'RNMB',
            ]],
        ]);
    }

    /**
     * The sheet's new number lands, and the supervision that pointed at the old
     * one points at the new one. Before the keys cascaded, the database refused
     * the move and the import kept the old number.
     */
    public function test_the_sheet_renumbers_a_faculty_and_their_supervision_follows(): void
    {
        $this->importWithCode(6694100)->assertStatus(200);

        $this->assertSame(6694100, $this->codeOf($this->professor->user_id));
        $this->assertSame(
            1,
            DB::table('supervisors')->where('faculty_id', 6694100)->where('student_id', 994101)->count()
        );
        $this->assertSame(0, DB::table('supervisors')->where('faculty_id', 994100)->count());
    }

    /**
     * A scholar's allocation form keeps its supervisors as a list of codes, with
     * no key on the column, so nothing moves it but us. A stale code there is
     * a form that cannot draw its own supervisor.
     */
    public function test_a_code_stored_in_a_form_moves_too(): void
    {
        $allocation = SupervisorAllocation::create([
            'student_id' => 994101,
            'supervisors' => [994100],
            'prefrences' => [994100],
        ]);

        $this->importWithCode(6694100)->assertStatus(200);

        $this->assertSame([6694100], $allocation->fresh()->supervisors);
        $this->assertSame([6694100], $allocation->fresh()->prefrences);
    }

    /** Someone else's code is not touched by a move next to it. */
    public function test_another_faculty_keeps_their_own_code(): void
    {
        $other = Faculty::create([
            'faculty_code' => 994200,
            'user_id' => $this->userAs('faculty')->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);

        $allocation = SupervisorAllocation::create([
            'student_id' => 994101,
            'supervisors' => [994100, 994200],
        ]);

        $this->importWithCode(6694100)->assertStatus(200);

        $this->assertSame([6694100, 994200], $allocation->fresh()->supervisors);
        $this->assertSame(994200, $this->codeOf($other->user_id));
    }
}
