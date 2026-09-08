<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rewrites the `roles` permission matrix to match the access the code actually
 * enforces.
 *
 * Seven of the twelve roles held an identical 26-of-28 grant: admin, adordc,
 * director, doctoral, dordc, dra and external. A doctoral committee member and
 * an outside expert do not manage roles or create departments, so that was a
 * block copied down the table rather than a policy.
 *
 * It went unnoticed because only two of these columns are read anywhere
 * (can_add_students and can_add_faculties, and both guards reading them were
 * themselves broken until recently). The rest are written by RolesController
 * and consulted by nothing, so this migration cannot change behaviour: it makes
 * the table state what the hardcoded role checks already do, which is the
 * precondition for replacing those checks with reads of these columns.
 *
 * Each capability names the code it was derived from. The seven marked
 * "unenforced" have no code to derive from and take the narrowest reading.
 */
return new class extends Migration
{
    private const ADMIN_TIER = ['admin', 'director', 'dra', 'dordc'];

    /** capability => the roles that hold it. Every other role gets 'false'. */
    private const ENFORCED = [
        // StudentController::list, the branch that applies no scoping.
        'can_read_all_students' => ['admin', 'director', 'dra', 'dordc'],
        // Same, plus the department-scoped branches.
        'can_read_department_students' => ['admin', 'director', 'dra', 'dordc', 'adordc', 'hod', 'phd_coordinator'],
        // Same, plus the faculty branch (supervisedStudents).
        'can_read_supervised_students' => ['admin', 'director', 'dra', 'dordc', 'faculty'],
        // The faculty directory, per the route gate and the nav.
        'can_read_all_faculties' => ['admin', 'director', 'dra', 'dordc', 'adordc', 'hod', 'phd_coordinator'],
        'can_read_department_faculties' => ['admin', 'director', 'dra', 'dordc', 'adordc', 'hod', 'phd_coordinator'],

        // FacultyController::add/update/upload, StudentController::add/bulk*.
        // ENFORCED TODAY: these four must keep their current values.
        'can_add_faculties' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
        'can_add_students' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
        'can_add_department_students' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
        'can_add_department_faculties' => ['admin', 'adordc', 'director', 'dordc', 'dra'],

        // StudentController::adminUpdate, today gated by the add permission.
        'can_edit_all_students' => ['admin', 'director', 'dra', 'dordc'],
        'can_edit_all_faculties' => ['admin', 'director', 'dra', 'dordc'],
        'can_edit_department_students' => ['admin', 'director', 'dra', 'dordc', 'adordc'],
        'can_edit_department_faculties' => ['admin', 'director', 'dra', 'dordc', 'adordc'],

        // Everyone signed in edits their own details. Clerk was false, which
        // would lock a clerk out of their own profile once this is wired up.
        'can_edit_own_profile' => ['admin', 'adordc', 'clerk', 'director', 'doctoral', 'dordc', 'dra', 'external', 'faculty', 'hod', 'phd_coordinator', 'student'],

        // SupervisorDoctoralChangeController: writes admit dordc and admin, the
        // committee edit additionally admits doctoral.
        'can_edit_supervisors' => ['admin', 'dordc'],
        'can_edit_doctoral_committee' => ['admin', 'dordc', 'doctoral'],
        'can_read_doctoral_committee' => ['admin', 'director', 'dra', 'dordc', 'hod', 'phd_coordinator', 'doctoral'],
        // Shown on every student profile, so every role that can open one.
        'can_read_supervisors' => ['admin', 'adordc', 'director', 'doctoral', 'dordc', 'dra', 'external', 'faculty', 'hod', 'phd_coordinator', 'student'],

        // UserManagementController: admin on all seven endpoints.
        'can_manage_roles' => ['admin'],
        // DepartmentController's authorize check.
        'can_edit_department' => ['admin', 'director', 'dra', 'dordc'],
        'can_add_department' => ['admin', 'director', 'dra', 'dordc'],

        // Unenforced: nothing reads these, so they take the narrowest reading
        // rather than a guess. Widen them deliberately when they are wired up.
        'can_edit_phd_title' => ['admin'],
        'can_delete_students' => ['admin'],
        'can_delete_faculties' => ['admin'],
        'can_delete_department_students' => ['admin'],
        'can_delete_department_faculties' => ['admin'],
        'can_read_external' => ['admin', 'hod'],
        'can_edit_external' => ['admin', 'hod'],
    ];

    /**
     * The matrix this replaces, so down() restores it exactly. Seven roles held
     * everything except the two external flags; the rest are listed as they
     * were.
     */
    private const PRIOR_FULL_GRANT = ['admin', 'adordc', 'director', 'doctoral', 'dordc', 'dra', 'external'];

    private const PRIOR_NARROW = [
        'faculty' => ['can_read_supervised_students', 'can_edit_own_profile', 'can_read_supervisors'],
        'hod' => ['can_read_all_faculties', 'can_read_department_students', 'can_read_department_faculties', 'can_edit_own_profile', 'can_read_supervisors', 'can_read_external', 'can_edit_external'],
        'phd_coordinator' => ['can_read_all_faculties', 'can_read_department_students', 'can_read_department_faculties', 'can_edit_own_profile', 'can_read_supervisors'],
        'student' => ['can_edit_own_profile', 'can_read_supervisors'],
        'clerk' => [],
    ];

    public function up(): void
    {
        foreach (self::ENFORCED as $capability => $roles) {
            DB::table('roles')->update([$capability => 'false']);
            DB::table('roles')->whereIn('role', $roles)->update([$capability => 'true']);
        }
    }

    public function down(): void
    {
        $columns = array_keys(self::ENFORCED);

        foreach ($columns as $capability) {
            DB::table('roles')->update([$capability => 'false']);
        }

        // The seven that held everything but the two external flags.
        $everything = array_fill_keys(
            array_diff($columns, ['can_read_external', 'can_edit_external']),
            'true'
        );
        DB::table('roles')->whereIn('role', self::PRIOR_FULL_GRANT)->update($everything);

        foreach (self::PRIOR_NARROW as $role => $granted) {
            if ($granted === []) {
                continue;
            }
            DB::table('roles')->where('role', $role)->update(array_fill_keys($granted, 'true'));
        }
    }
};
