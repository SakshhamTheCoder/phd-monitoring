<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The roles, and what each one may do.
 *
 * Only two role rows are created by migrations, clerk and ug_student. The rest
 * were inserted by hand at some point and never written down, and the migration
 * that grants capabilities only UPDATEs rows that already exist. So a database
 * built purely from migrations came up with two roles and no capabilities, and
 * the test suite was green only because it ran against a developer's own
 * database, which happened to hold the missing eleven.
 *
 * The grants below are the state those migrations produce, captured per role as
 * the list it is allowed rather than as fifty-four columns of 'true'/'false'.
 * Anything not named here is denied.
 *
 * Idempotent, and safe to run against a populated database: it inserts a role
 * that is missing and never touches one that already exists, so a live
 * database's capabilities cannot be overwritten by this snapshot of them.
 */
class RolesSeeder extends Seeder
{
    /** role => the capabilities it is granted. */
    private const GRANTS = [
        'admin' => [
            'can_read_all_students',
            'can_read_all_faculties',
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_manage_faculties',
            'can_manage_students',
            'can_read_supervisors',
            'can_read_doctoral_committee',
            'can_edit_supervisors',
            'can_edit_doctoral_committee',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_edit_department',
            'can_add_department',
            'can_manage_users',
            'can_manage_form_levels',
            'can_manage_supervisor_records',
            'can_manage_clerks',
            'can_mark_attendance',
            'can_read_leave_reason',
            'can_manage_app_settings',
            'can_read_leave_settings',
            'can_resend_external_review',
            'can_propose_supervisor_changes',
            'can_manage_supervisor_changes',
            'can_manage_projects',
            'can_manage_all_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_manage_urf',
        ],
        'adordc' => [
            'can_read_department_students',
            'can_read_department_faculties',
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_manage_faculties',
            'can_manage_students',
            'can_read_supervisors',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_manage_projects',
            'can_manage_all_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'clerk' => [
            'can_mark_attendance',
            'can_read_own_clerk_departments',
            'can_read_leave_settings',
        ],
        'director' => [
            'can_read_all_students',
            'can_read_all_faculties',
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_manage_faculties',
            'can_manage_students',
            'can_read_supervisors',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_edit_department',
            'can_add_department',
            'can_manage_projects',
            'can_manage_all_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'doctoral' => [
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_read_supervisors',
            'can_read_doctoral_committee',
            'can_edit_doctoral_committee',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_read_committee_students',
            'can_propose_supervisor_changes',
            'can_read_faculty_directory',
            'can_read_faculty_phone',
        ],
        'dordc' => [
            'can_read_all_students',
            'can_read_all_faculties',
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_manage_faculties',
            'can_manage_students',
            'can_read_supervisors',
            'can_read_doctoral_committee',
            'can_edit_supervisors',
            'can_edit_doctoral_committee',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_edit_department',
            'can_add_department',
            'can_resend_external_review',
            'can_propose_supervisor_changes',
            'can_manage_supervisor_changes',
            'can_manage_projects',
            'can_manage_all_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'dra' => [
            'can_read_all_students',
            'can_read_all_faculties',
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_manage_faculties',
            'can_manage_students',
            'can_read_supervisors',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_edit_department',
            'can_add_department',
            'can_manage_projects',
            'can_manage_all_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'external' => [
            'can_edit_all_students',
            'can_edit_all_faculties',
            'can_edit_department_students',
            'can_edit_department_faculties',
            'can_edit_own_profile',
            'can_edit_phd_title',
            'can_add_department_students',
            'can_add_department_faculties',
            'can_read_supervisors',
            'can_delete_department_students',
            'can_delete_department_faculties',
            'can_delete_faculties',
            'can_delete_students',
            'can_manage_roles',
            'can_read_committee_students',
            'can_read_faculty_directory',
            'can_read_faculty_phone',
        ],
        'faculty' => [
            'can_read_supervised_students',
            'can_edit_own_profile',
            'can_read_supervisors',
            'can_manage_projects',
            'can_suggest_examiners',
            'can_read_faculty_directory',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'hod' => [
            'can_read_department_students',
            'can_read_department_faculties',
            'can_edit_own_profile',
            'can_read_supervisors',
            'can_read_doctoral_committee',
            'can_read_external',
            'can_edit_external',
            'can_read_leave_reason',
            'can_read_leave_settings',
            'can_propose_supervisor_changes',
            'can_manage_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'phd_coordinator' => [
            'can_read_department_students',
            'can_read_department_faculties',
            'can_edit_own_profile',
            'can_manage_faculties',
            'can_read_supervisors',
            'can_read_doctoral_committee',
            'can_resend_external_review',
            'can_propose_supervisor_changes',
            'can_manage_projects',
            'can_read_faculty_directory',
            'can_read_faculty_supervision',
            'can_read_faculty_phone',
            'can_read_urf_mentees',
        ],
        'student' => [
            'can_edit_own_profile',
            'can_read_supervisors',
            'can_read_leave_reason',
            'can_read_leave_settings',
            'can_manage_own_publications',
            'can_edit_own_student_profile',
            'can_read_own_leave_balance',
            'can_apply_for_leave',
            'can_read_faculty_directory',
        ],
        'ug_student' => [
            'can_manage_own_publications',
            'can_read_faculty_directory',
            'can_apply_for_urf',
        ],
    ];

    public function run(): void
    {
        $columns = array_values(array_filter(
            Schema::getColumnListing('roles'),
            fn ($column) => str_starts_with($column, 'can_')
        ));

        $existing = DB::table('roles')->pluck('role')->all();

        foreach (self::GRANTS as $role => $granted) {
            // Insert only. An established database has had its capabilities
            // tuned by migrations and possibly by hand, and this seeder's copy
            // of them is a snapshot; writing it over a live row would undo that
            // silently. The gap this closes is a role that does not exist at
            // all, which is every role but clerk and ug_student on a database
            // built from migrations.
            if (in_array($role, $existing, true)) {
                continue;
            }

            $values = [];
            foreach ($columns as $column) {
                $values[$column] = in_array($column, $granted, true) ? 'true' : 'false';
            }

            DB::table('roles')->insert(
                $values + ['role' => $role, 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }
}
