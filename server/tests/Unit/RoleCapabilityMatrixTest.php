<?php

namespace Tests\Unit;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The before-and-after check for replacing hardcoded role lists with capability
 * columns.
 *
 * EXPECTED below is a transcription of the role lists the controllers checked
 * before the swap, taken from the code as it stood, not from the migration that
 * populated the columns. Written down here it serves twice: run before the
 * swap it proves the columns match what the code enforced, and run after it
 * proves the swapped code still enforces the same sets, because the code now
 * reads these columns.
 *
 * A failure means a capability grants a role something it did not have, or has
 * taken something away. Either is a policy change, and neither belongs in a
 * refactor.
 */
class RoleCapabilityMatrixTest extends TestCase
{
    use DatabaseTransactions;

    private const ALL_ROLES = [
        'admin', 'adordc', 'clerk', 'director', 'doctoral', 'dordc',
        'dra', 'external', 'faculty', 'hod', 'phd_coordinator', 'student',
    ];

    /** capability => exactly the roles the pre-swap code admitted. */
    private const EXPECTED = [
        // StudentController::list
        'can_read_all_students' => ['admin', 'director', 'dra', 'dordc'],
        'can_read_department_students' => ['hod', 'phd_coordinator', 'adordc'],
        'can_read_supervised_students' => ['faculty'],
        'can_read_committee_students' => ['doctoral', 'external'],

        // FacultyController::list
        'can_read_all_faculties' => ['admin', 'director', 'dra', 'dordc'],
        'can_read_department_faculties' => ['hod', 'phd_coordinator', 'adordc'],

        // FacultyController::add/update/upload, StudentController::add/bulk*
        'can_add_faculties' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
        'can_add_students' => ['admin', 'adordc', 'director', 'dordc', 'dra'],

        // DepartmentController::authorize
        'can_edit_department' => ['admin', 'director', 'dra', 'dordc'],
        'can_add_department' => ['admin', 'director', 'dra', 'dordc'],

        // SupervisorDoctoralChangeController
        'can_manage_supervisor_changes' => ['dordc', 'admin'],
        'can_read_supervisor_change_requests' => ['hod', 'phd_coordinator', 'admin', 'doctoral', 'dordc'],
        'can_edit_doctoral_committee' => ['admin', 'doctoral', 'dordc'],
        'can_edit_supervisors' => ['dordc', 'admin'],
        'can_read_doctoral_committee' => ['hod', 'phd_coordinator', 'admin', 'doctoral', 'dordc'],

        // Admin-only controllers
        'can_manage_users' => ['admin'],
        'can_manage_form_levels' => ['admin'],
        'can_manage_supervisor_records' => ['admin'],
        'can_manage_clerks' => ['admin'],
        'can_manage_app_settings' => ['admin'],

        // ClerkController
        'can_mark_attendance' => ['clerk', 'admin'],
        'can_read_own_clerk_departments' => ['clerk'],
        'can_read_leave_reason' => ['student', 'hod', 'admin'],
        'can_read_leave_settings' => ['admin', 'clerk', 'hod', 'student'],

        // ExternalReviewController::RESEND_ROLES
        'can_resend_external_review' => ['dordc', 'phd_coordinator', 'admin'],

        // ProjectAuthorizes
        'can_manage_projects' => ['faculty', 'hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director', 'admin'],
        'can_manage_all_projects' => ['dordc', 'adordc', 'dra', 'director', 'admin'],

        // Student-only endpoints
        'can_manage_own_publications' => ['student'],
        'can_edit_own_student_profile' => ['student'],
        'can_read_own_leave_balance' => ['student'],
        'can_apply_for_leave' => ['student'],

        // SuggestionController::suggestExaminer
        'can_suggest_examiners' => ['faculty'],
    ];

    public static function capabilities(): array
    {
        return array_map(fn ($c) => [$c], array_keys(self::EXPECTED));
    }

    /**
     * @dataProvider capabilities
     */
    public function test_a_capability_is_held_by_exactly_the_roles_that_had_it(string $capability): void
    {
        $expected = self::EXPECTED[$capability];
        $actual = Role::query()
            ->where($capability, 'true')
            ->pluck('role')
            ->all();

        sort($expected);
        sort($actual);

        $this->assertSame(
            $expected,
            $actual,
            "{$capability} is granted to a different set of roles than the code enforced before the swap."
        );
    }

    /** Every role in the matrix is a real role, so a typo cannot pass silently. */
    public function test_the_matrix_names_only_real_roles(): void
    {
        $known = Role::pluck('role')->all();

        foreach (self::EXPECTED as $capability => $roles) {
            foreach ($roles as $role) {
                $this->assertContains($role, $known, "{$capability} names an unknown role '{$role}'.");
            }
        }
    }

    /** may() must read the acting role and fail closed on anything but 'true'. */
    public function test_may_reads_the_acting_role(): void
    {
        $user = User::query()->firstOrFail();
        $user->current_role_id = Role::where('role', 'clerk')->firstOrFail()->id;
        $user->save();
        $user = $user->fresh();

        $this->assertTrue($user->may('can_mark_attendance'));
        $this->assertFalse($user->may('can_manage_users'));
        $this->assertFalse($user->may('can_nonexistent_capability'));
    }

    /** Guards against a role being added without a decision about its access. */
    public function test_every_role_is_accounted_for(): void
    {
        $this->assertEqualsCanonicalizing(self::ALL_ROLES, Role::pluck('role')->all());
    }
}
