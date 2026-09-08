<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Makes the `roles` table describe the access the code already enforces, so the
 * hardcoded role lists can later be replaced by reads of these columns without
 * anybody's access changing.
 *
 * Two rules, both deliberate:
 *
 *  - A column is only written when there is code that enforces it. Its value is
 *    then the exact role list that code checks, taken from the line named
 *    beside it. Nothing is widened or narrowed on the way.
 *  - A column with no enforcing code is left exactly as it is. `can_delete_*`,
 *    `can_edit_phd_title`, `can_edit_own_profile` and the rest describe
 *    capabilities the app never checks, so there is no current permission to
 *    preserve and guessing one would invent policy. Clerk keeps
 *    can_edit_own_profile = false for that reason: no code grants it today.
 *
 * The twenty new columns cover gates the original vocabulary had no word for:
 * attendance, clerks, settings, projects, publications and the supervisor and
 * doctoral change flows, none of which existed when this table was designed.
 */
return new class extends Migration
{
    /**
     * Existing columns that have enforcing code, with the exact role list that
     * code checks.
     */
    private const DERIVED = [
        // StudentController::list, the branch that applies no scoping.
        'can_read_all_students' => ['admin', 'director', 'dra', 'dordc'],
        // StudentController::list, the hod/phd_coordinator and adordc branches.
        'can_read_department_students' => ['hod', 'phd_coordinator', 'adordc'],
        // StudentController::list, the faculty branch (supervisedStudents).
        'can_read_supervised_students' => ['faculty'],

        // FacultyController::list, the branch that applies no scoping.
        'can_read_all_faculties' => ['admin', 'director', 'dra', 'dordc'],
        // FacultyController::list, its department and adordc branches.
        'can_read_department_faculties' => ['hod', 'phd_coordinator', 'adordc'],

        // DepartmentController::authorize (line 35), which covers both.
        'can_edit_department' => ['admin', 'director', 'dra', 'dordc'],
        'can_add_department' => ['admin', 'director', 'dra', 'dordc'],

        // SupervisorDoctoralChangeController lines 26, 238, 293.
        'can_edit_supervisors' => ['dordc', 'admin'],
        // Same controller, line 167.
        'can_edit_doctoral_committee' => ['admin', 'doctoral', 'dordc'],
        // Same controller, line 102.
        'can_read_doctoral_committee' => ['hod', 'phd_coordinator', 'admin', 'doctoral', 'dordc'],

        // FacultyController::add/update/upload and StudentController::add,
        // bulkUpload, bulkUpdate, adminUpdate. Already correct; restated so the
        // table is complete and a later change here is visible.
        'can_add_faculties' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
        'can_add_students' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
    ];

    /** Gates the existing columns had no word for. */
    private const NEW_CAPABILITIES = [
        // StudentController::list, the doctoral/external branch (doctoredStudents).
        'can_read_committee_students' => ['doctoral', 'external'],

        // UserManagementController, all seven endpoints.
        'can_manage_users' => ['admin'],
        // FormLevelController lines 25 and 171.
        'can_manage_form_levels' => ['admin'],
        // SupervisorController lines 15 and 51.
        'can_manage_supervisor_records' => ['admin'],
        // ClerkController::authorizeAdmin (line 819).
        'can_manage_clerks' => ['admin'],

        // ClerkController's attendance endpoints (lines 95, 166, 296, 314, 479,
        // 519, 568, 748).
        'can_mark_attendance' => ['clerk', 'admin'],
        // ClerkController::myDepartments (line 70).
        'can_read_own_clerk_departments' => ['clerk'],
        // ClerkController line 717: who receives a leave's reason and the HOD's
        // comments, as opposed to just its dates and status.
        'can_read_leave_reason' => ['student', 'hod', 'admin'],

        // AppSettingController::save (line 35).
        'can_manage_app_settings' => ['admin'],
        // AppSetting::GROUPS['leave']['readers'].
        'can_read_leave_settings' => ['admin', 'clerk', 'hod', 'student'],

        // ExternalReviewController::RESEND_ROLES.
        'can_resend_external_review' => ['dordc', 'phd_coordinator', 'admin'],

        // SupervisorDoctoralChangeController line 102.
        'can_read_supervisor_change_requests' => ['hod', 'phd_coordinator', 'admin', 'doctoral', 'dordc'],
        // Same controller, lines 26, 238 and 293.
        'can_manage_supervisor_changes' => ['dordc', 'admin'],

        // ProjectAuthorizes::canManage.
        'can_manage_projects' => ['faculty', 'hod', 'phd_coordinator', 'dordc', 'adordc', 'dra', 'director', 'admin'],
        // ProjectAuthorizes::$privileged, which writes any project.
        'can_manage_all_projects' => ['dordc', 'adordc', 'dra', 'director', 'admin'],

        // PublicationController::get and PatentsController, both student-only.
        'can_manage_own_publications' => ['student'],
        // StudentController::updateProfile (line 556).
        'can_edit_own_student_profile' => ['student'],
        // StudentLeaveFormController::balance (line 116).
        'can_read_own_leave_balance' => ['student'],
        // StudentLeaveFormController::createForm, student-only.
        'can_apply_for_leave' => ['student'],
        // SuggestionController::suggestExaminer (line 77).
        'can_suggest_examiners' => ['faculty'],
    ];

    /**
     * What DERIVED held before this ran, so down() restores it exactly. Seven
     * roles carried an identical grant across the whole table.
     */
    private const FULL_GRANT = ['admin', 'adordc', 'director', 'doctoral', 'dordc', 'dra', 'external'];

    private const PRIOR = [
        'can_read_all_students' => self::FULL_GRANT,
        'can_read_department_students' => [...self::FULL_GRANT, 'hod', 'phd_coordinator'],
        'can_read_supervised_students' => [...self::FULL_GRANT, 'faculty'],
        'can_read_all_faculties' => [...self::FULL_GRANT, 'hod', 'phd_coordinator'],
        'can_read_department_faculties' => [...self::FULL_GRANT, 'hod', 'phd_coordinator'],
        'can_edit_department' => self::FULL_GRANT,
        'can_add_department' => self::FULL_GRANT,
        'can_edit_supervisors' => self::FULL_GRANT,
        'can_edit_doctoral_committee' => self::FULL_GRANT,
        'can_read_doctoral_committee' => self::FULL_GRANT,
        // Left as 2026_09_08_000004 set them.
        'can_add_faculties' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
        'can_add_students' => ['admin', 'adordc', 'director', 'dordc', 'dra'],
    ];

    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            foreach (array_keys(self::NEW_CAPABILITIES) as $column) {
                $table->enum($column, ['true', 'false'])->default('false');
            }
        });

        $this->apply(self::DERIVED);
        $this->apply(self::NEW_CAPABILITIES);
    }

    public function down(): void
    {
        $this->apply(self::PRIOR);

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(array_keys(self::NEW_CAPABILITIES));
        });
    }

    private function apply(array $matrix): void
    {
        foreach ($matrix as $capability => $roles) {
            DB::table('roles')->update([$capability => 'false']);
            DB::table('roles')->whereIn('role', $roles)->update([$capability => 'true']);
        }
    }
};
