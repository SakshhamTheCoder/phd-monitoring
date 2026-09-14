<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * CourseController::add/update/delete/importCoursesFromCSV and every method on
 * OutsideExpertController checked nothing at all: any signed-in user, a
 * student included, could rewrite the course catalog or the outside expert
 * list. This grants the capabilities that now gate those endpoints.
 *
 * can_manage_courses is new. There was no existing capability for the right
 * audience, so one is added here rather than overloading an unrelated one.
 *   - Granted to: hod, phd_coordinator, admin.
 *   - Derived from client-new/src/App.jsx:166 (the /courses management route
 *     guard) and the route file's own comment at
 *     server/routes/base/courses.php:8, "Course management (Admin/HOD/Coordinator)".
 *
 * can_read_external and can_edit_external have existed on `roles` since
 * 0001_00_00_create_roles_table.php but nothing read them until now.
 *   - can_read_external granted to: admin, hod, phd_coordinator, doctoral, dordc.
 *     This is the exact role set that can reach
 *     SupervisorDoctoralManager.jsx:294 (which calls GET /outside-experts/all
 *     to pick an external supervisor), because that component is only
 *     reachable by the roles holding can_propose_supervisor_changes. See
 *     2026_09_08_000005_derive_role_capabilities_from_enforced_access.php
 *     (under its pre-rename name can_read_supervisor_change_requests) and the
 *     rename in 2026_09_10_000005_rename_capability_columns_to_match_their_verbs.php.
 *   - can_edit_external granted to: admin. The Outside Experts management
 *     page (client-new/src/App.jsx:196) is registered only for admin.
 *
 * Both columns default to 'false' for every role, so without this grant the
 * fix for the missing authorization checks would also break the working UI
 * for the roles above.
 */
return new class extends Migration
{
    private const READ_EXTERNAL = ['admin', 'hod', 'phd_coordinator', 'doctoral', 'dordc'];
    private const EDIT_EXTERNAL = ['admin'];
    private const MANAGE_COURSES = ['hod', 'phd_coordinator', 'admin'];

    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->enum('can_manage_courses', ['true', 'false'])->default('false');
        });

        $this->apply('can_manage_courses', self::MANAGE_COURSES);
        $this->apply('can_read_external', self::READ_EXTERNAL);
        $this->apply('can_edit_external', self::EDIT_EXTERNAL);
    }

    public function down(): void
    {
        DB::table('roles')->update([
            'can_read_external' => 'false',
            'can_edit_external' => 'false',
        ]);

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('can_manage_courses');
        });
    }

    private function apply(string $capability, array $roles): void
    {
        DB::table('roles')->update([$capability => 'false']);
        DB::table('roles')->whereIn('role', $roles)->update([$capability => 'true']);
    }
};
