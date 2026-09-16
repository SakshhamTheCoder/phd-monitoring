<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Undergraduates on the Undergraduate Research Fellowship (URF) need a login
 * that shows none of the PhD modules. A PhD `student` needs a students row
 * full of PhD fields, so they get a role of their own instead, backed by
 * nothing but their URF application.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->enum('can_apply_for_urf', ['true', 'false'])->default('false');
            $table->enum('can_manage_urf', ['true', 'false'])->default('false');
        });

        DB::table('roles')->insertOrIgnore([
            'role' => 'ug_student',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // A fellow adds publications against their project and picks mentors
        // from the faculty directory.
        DB::table('roles')->where('role', 'ug_student')->update([
            'can_apply_for_urf' => 'true',
            'can_manage_own_publications' => 'true',
            'can_read_faculty_directory' => 'true',
        ]);
        DB::table('roles')->where('role', 'admin')->update(['can_manage_urf' => 'true']);
    }

    public function down(): void
    {
        // Deleting the role cascades to users holding it, so leave it if used.
        $role = DB::table('roles')->where('role', 'ug_student')->first();
        if ($role && !DB::table('users')->where('role_id', $role->id)->exists()) {
            DB::table('roles')->where('id', $role->id)->delete();
        }

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn(['can_apply_for_urf', 'can_manage_urf']);
        });
    }
};
