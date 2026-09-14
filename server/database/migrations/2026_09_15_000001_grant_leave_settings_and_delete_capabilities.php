<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * UserManagementController::delete only ever checked can_manage_users, but
 * deleting a user cascades: students.user_id and faculty.user_id are both
 * onDelete('cascade'), so deleting a student's or a faculty member's account
 * also deletes their scholar or faculty record. Nothing named that
 * consequence as its own permission.
 *
 * can_delete_students and can_delete_faculties have existed on `roles` since
 * 0001_00_00_create_roles_table.php but were never read by any check, the
 * same shape of bug 2026_09_14_000001 fixed for can_read_external. This
 * grants them to admin, the only role that currently holds can_manage_users
 * (see 2026_09_08_000005_derive_role_capabilities_from_enforced_access.php),
 * so wiring the columns into the delete endpoint changes no one's access.
 *
 * can_read_leave_settings needs no grant here: it was seeded by
 * 2026_09_08_000005 with the exact role list AppSetting::GROUPS['leave']
 * ['readers'] still checks (admin, clerk, hod, student), so pointing
 * AppSettingController::show() at the column instead of the array is a pure
 * refactor.
 */
return new class extends Migration
{
    private const DELETE_STUDENTS = ['admin'];
    private const DELETE_FACULTIES = ['admin'];

    public function up(): void
    {
        $this->apply('can_delete_students', self::DELETE_STUDENTS);
        $this->apply('can_delete_faculties', self::DELETE_FACULTIES);
    }

    public function down(): void
    {
        DB::table('roles')->update([
            'can_delete_students' => 'false',
            'can_delete_faculties' => 'false',
        ]);
    }

    private function apply(string $capability, array $roles): void
    {
        DB::table('roles')->update([$capability => 'false']);
        DB::table('roles')->whereIn('role', $roles)->update([$capability => 'true']);
    }
};
