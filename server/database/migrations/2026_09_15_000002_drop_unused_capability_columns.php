<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Drops 14 capability columns that no code path reads. Verified independently
 * of the triage that first flagged them, per the product owner's request
 * after 2026_09_14_000001 found can_read_external wrongly written off the
 * same way while it was the only gate on a real, unguarded feature.
 *
 * Verification performed for each of the 14, against server/app, routes,
 * tests, config, database/seeders, docs/prod-audit.sql, deploy/deploy.sh and
 * client-new/src:
 *
 *  - can_edit_all_students, can_edit_department_students,
 *    can_add_department_students: StudentController::add, bulkUpload,
 *    bulkUpdate and adminUpdate gate on can_manage_students alone.
 *    Department scope is separately enforced by
 *    StudentController::writableDepartmentIds(), which hardcodes a check for
 *    the 'adordc' role and reads no capability column at all.
 *  - can_edit_all_faculties, can_edit_department_faculties,
 *    can_add_department_faculties: FacultyController::add/update gate on
 *    can_manage_faculties alone. Department scope comes from
 *    FacultyController::facultyWriteDepartmentIds(), which reads
 *    can_read_all_faculties (a different, live column) and then hardcodes
 *    the same 'adordc' check.
 *  - can_delete_department_students, can_delete_department_faculties:
 *    UserManagementController::delete gates on can_manage_users plus the
 *    live can_delete_students/can_delete_faculties columns (see
 *    2026_09_15_000001). There is no department-scoped delete path for
 *    either of these two to describe.
 *  - can_edit_own_profile: StudentController::canEditProfile() checks
 *    can_edit_own_student_profile, a different, live column. This one is
 *    never read.
 *  - can_edit_phd_title: the phd_title field's editability is governed
 *    entirely by Student::phdTitleLocked() (an IRB business-rule check), not
 *    by any capability. Both write paths that touch phd_title
 *    (StudentController::adminUpdate, gated by can_manage_students, and
 *    updateProfile, gated by canEditProfile()) never reference this column.
 *  - can_read_supervisors: no controller returns supervisor data gated by
 *    this name. SupervisorController::assign/assignDoctoral check
 *    can_manage_supervisor_records; SupervisorAllocationController's reads
 *    require only auth:sanctum.
 *  - can_read_doctoral_committee, can_edit_supervisors: both were derived
 *    accurately by 2026_09_08_000005 from SupervisorDoctoralChangeController
 *    lines that, at the time, read these exact names. That controller was
 *    later repointed at can_propose_supervisor_changes and
 *    can_manage_supervisor_changes instead (the rename trail runs through
 *    2026_09_10_000005), leaving these two as orphaned duplicates. The
 *    controller today reads only can_manage_supervisor_changes,
 *    can_propose_supervisor_changes and can_edit_doctoral_committee.
 *  - can_manage_roles: RolesController was deleted outright (see git history
 *    for server/app/Http/Controllers/RolesController.php); the only
 *    surviving route under routes/base/roles.php is a read-only role list
 *    that deliberately excludes the can_* columns. No path writes a role's
 *    capabilities, so there is nothing for this to gate.
 *
 * A caveat the task asked to be verified and reported rather than assumed:
 * these columns do NOT all hold 'false' for every role. can_edit_own_profile
 * and can_read_supervisors are 'true' for every role except clerk;
 * can_read_doctoral_committee and can_edit_supervisors hold the exact role
 * sets 2026_09_08_000005 derived for them; the rest hold 'true' for
 * admin/adordc/director/doctoral/dordc/dra/external, the same FULL_GRANT seed
 * set that migration's own PRIOR constant records as the table's original,
 * never-enforced default. 2026_09_08_000005's docblock says as much
 * directly: "can_delete_*, can_edit_phd_title, can_edit_own_profile and the
 * rest describe capabilities the app never checks, so there is no current
 * permission to preserve." The non-'false' values are leftover seed data or
 * orphaned duplicates, not evidence of use, confirmed above by the absence of
 * any read in code. No behavioral grant is lost by dropping them, because no
 * code path was ever conditioned on their value.
 */
return new class extends Migration
{
    private const DROPPED = [
        'can_edit_all_students',
        'can_edit_all_faculties',
        'can_edit_department_students',
        'can_edit_department_faculties',
        'can_add_department_students',
        'can_add_department_faculties',
        'can_edit_own_profile',
        'can_edit_phd_title',
        'can_read_supervisors',
        'can_read_doctoral_committee',
        'can_edit_supervisors',
        'can_manage_roles',
        'can_delete_department_students',
        'can_delete_department_faculties',
    ];

    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(self::DROPPED);
        });
    }

    /**
     * Recreates every dropped column with its original definition from
     * 0001_00_00_create_roles_table.php: enum('true','false'), default
     * 'false'. Restoring the schema does not restore the pre-drop data; the
     * columns come back empty (defaulted to 'false' for every role), because
     * no code reads them and no migration reconstructs point-in-time values
     * for a rolled-back drop.
     */
    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->enum('can_edit_all_students', ['true', 'false'])->default('false');
            $table->enum('can_edit_all_faculties', ['true', 'false'])->default('false');
            $table->enum('can_edit_department_students', ['true', 'false'])->default('false');
            $table->enum('can_edit_department_faculties', ['true', 'false'])->default('false');
            $table->enum('can_add_department_students', ['true', 'false'])->default('false');
            $table->enum('can_add_department_faculties', ['true', 'false'])->default('false');
            $table->enum('can_edit_own_profile', ['true', 'false'])->default('false');
            $table->enum('can_edit_phd_title', ['true', 'false'])->default('false');
            $table->enum('can_read_supervisors', ['true', 'false'])->default('false');
            $table->enum('can_read_doctoral_committee', ['true', 'false'])->default('false');
            $table->enum('can_edit_supervisors', ['true', 'false'])->default('false');
            $table->enum('can_manage_roles', ['true', 'false'])->default('false');
            $table->enum('can_delete_department_students', ['true', 'false'])->default('false');
            $table->enum('can_delete_department_faculties', ['true', 'false'])->default('false');
        });
    }
};
