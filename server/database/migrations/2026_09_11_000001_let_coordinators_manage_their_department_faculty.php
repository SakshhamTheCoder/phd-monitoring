<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `can_manage_faculties` gated add/update/upload on FacultyController, and only
 * institute-wide roles held it. Those endpoints are now scoped to the writer's
 * own department (see FacultyController::facultyWriteDepartmentIds), so a phd_coordinator
 * can maintain their department's faculty records without gaining write access
 * to every other department.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('roles')->where('role', 'phd_coordinator')->update([
            'can_manage_faculties' => 'true',
        ]);
    }

    public function down(): void
    {
        DB::table('roles')->where('role', 'phd_coordinator')->update([
            'can_manage_faculties' => 'false',
        ]);
    }
};
