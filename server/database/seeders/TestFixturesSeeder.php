<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * The smallest graph the test suite assumes already exists.
 *
 * Several tests reach for whatever happens to be in the database, for example
 * `User::query()->firstOrFail()` in AvailableRolesTest and
 * CapabilityGateParityTest. On a developer's own database that found a real
 * person; on a database built from migrations it found nothing, and a hundred
 * tests errored. This gives them something deterministic to find.
 *
 * Deliberately not called from DatabaseSeeder: these rows are scaffolding for
 * tests, and `php artisan db:seed` runs in production too. Call it from a test's
 * setUp, or seed a test database with
 *   php artisan db:seed --class=TestFixturesSeeder
 *
 * Idempotent. Reads roles from RolesSeeder's output, so run that first.
 */
class TestFixturesSeeder extends Seeder
{
    public const DEPARTMENT_CODE = 'TSTD';
    // A real official code, not an invented one: the superseded-code test looks
    // for a department whose code is the target of a DepartmentCodes alias.
    public const SECOND_DEPARTMENT_CODE = 'BTD';
    public const FACULTY_CODE = 999001;
    public const HOD_FACULTY_CODE = 999002;
    public const REVIEWER_FACULTY_BASE = 999010;
    public const STUDENT_ROLL = 999101;
    public const SECOND_STUDENT_ROLL = 999102;
    public const ROLE_STUDENT_ROLL = 999103;
    public const OUTSIDER_FACULTY_CODE = 999003;

    public function run(): void
    {
        $department = Department::firstOrCreate(
            ['code' => self::DEPARTMENT_CODE],
            ['name' => 'Test Department']
        );

        // A second one, because the officer import tests move an officer between
        // departments and refuse a code another department already holds. Both
        // open by asserting there are two.
        Department::firstOrCreate(
            ['code' => self::SECOND_DEPARTMENT_CODE],
            ['name' => 'Biotechnology']
        );

        $supervisor = $this->user('faculty', 'supervisor@fixture.test', 'Fixture', 'Supervisor');
        Faculty::firstOrCreate(
            ['faculty_code' => self::FACULTY_CODE],
            [
                'user_id' => $supervisor->id,
                'designation' => 'Professor',
                'department_id' => $department->id,
                'type' => 'internal',
            ]
        );

        // A head, distinct from the supervisor: the leave flow reads
        // $student->department->hod_id and expects a Faculty behind it.
        $head = $this->user('hod', 'hod@fixture.test', 'Fixture', 'Head');
        Faculty::firstOrCreate(
            ['faculty_code' => self::HOD_FACULTY_CODE],
            [
                'user_id' => $head->id,
                'designation' => 'Professor and Head',
                'department_id' => $department->id,
                'type' => 'internal',
            ]
        );
        $department->forceFill(['hod_id' => self::HOD_FACULTY_CODE])->save();

        $scholar = $this->user('student', 'scholar@fixture.test', 'Fixture', 'Scholar');
        Student::firstOrCreate(
            ['roll_no' => self::STUDENT_ROLL],
            [
                'user_id' => $scholar->id,
                'department_id' => $department->id,
                'date_of_registration' => now()->subYears(2)->toDateString(),
                'current_status' => 'full-time',
                'overall_progress' => 0,
            ]
        );

        $second = Department::where('code', self::SECOND_DEPARTMENT_CODE)->first();
        $outsider = $this->user('faculty', 'outsider@fixture.test', 'Fixture', 'Outsider');
        Faculty::firstOrCreate(
            ['faculty_code' => self::OUTSIDER_FACULTY_CODE],
            [
                'user_id' => $outsider->id,
                'designation' => 'Assistant Professor',
                'department_id' => $second->id,
                'type' => 'internal',
            ]
        );

        // A second scholar. StudentSheetImportTest refuses a row that pairs two
        // different scholars, and LeaveWindowTest checks one scholar's leave does
        // not leak into another's day; both need two to have anything to compare.
        $secondScholar = $this->user('student', 'scholar2@fixture.test', 'Fixture', 'Scholar Two');
        Student::firstOrCreate(
            ['roll_no' => self::SECOND_STUDENT_ROLL],
            [
                'user_id' => $secondScholar->id,
                'department_id' => $department->id,
                'date_of_registration' => now()->subYears(1)->toDateString(),
                'current_status' => 'full-time',
                'overall_progress' => 0,
            ]
        );

        // The supervisor actually supervises the scholar. Without the pivot row a
        // scholar has no supervisor, and every test that needs one skips itself
        // rather than failing, which is worse: it looks like it passed.
        DB::table('supervisors')->updateOrInsert([
            'student_id' => self::STUDENT_ROLL,
            'faculty_id' => self::FACULTY_CODE,
        ]);

        // One account per role. CapabilityGateParityTest drives each endpoint as
        // every role and skips any role it cannot find an account for, so without
        // these it silently asserted nothing on a clean database.
        foreach (Role::query()->pluck('role') as $role) {
            $account = $this->user($role, $role . '@fixture.test', 'Fixture', ucfirst(str_replace('_', ' ', $role)));

            // A role held by a faculty member reads $user->faculty on most paths,
            // so a bare account is not enough to stand in for one. Keyed by the
            // account, not the code, so adding a role here never reshuffles codes
            // that a database seeded earlier already holds.
            if (in_array($role, ['faculty', 'external', 'dordc', 'adordc', 'dra', 'director', 'doctoral', 'phd_coordinator'], true)) {
                $faculty = Faculty::where('user_id', $account->id)->first()
                    ?? Faculty::create([
                        'faculty_code' => $this->nextReviewerCode(),
                        'user_id' => $account->id,
                        'designation' => 'Professor',
                        'department_id' => $department->id,
                        'type' => $role === 'external' ? 'external' : 'internal',
                    ]);

                if ($role === 'adordc') {
                    $department->forceFill(['adordc_id' => $faculty->faculty_code])->save();
                }
            }

            // A scholar account with no student row crashes every page that reads
            // $user->student, which no real scholar would see.
            if ($role === 'student' && !Student::where('user_id', $account->id)->exists()) {
                Student::create([
                    'roll_no' => self::ROLE_STUDENT_ROLL,
                    'user_id' => $account->id,
                    'department_id' => $department->id,
                    'date_of_registration' => now()->subYears(1)->toDateString(),
                    'current_status' => 'full-time',
                    'overall_progress' => 0,
                ]);
            }
        }
    }

    private function nextReviewerCode(): int
    {
        $highest = Faculty::whereBetween('faculty_code', [self::REVIEWER_FACULTY_BASE, self::REVIEWER_FACULTY_BASE + 89])
            ->max('faculty_code');

        return $highest ? $highest + 1 : self::REVIEWER_FACULTY_BASE;
    }

    private function user(string $role, string $email, string $first, string $last): User
    {
        $roleId = Role::where('role', $role)->value('id');

        $user = User::firstOrNew(['email' => $email]);
        $user->forceFill([
            'first_name' => $first,
            'last_name' => $last,
            'password' => $user->password ?: Hash::make('fixture-password'),
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }
}
