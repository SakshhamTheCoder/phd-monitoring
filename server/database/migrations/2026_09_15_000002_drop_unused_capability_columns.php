<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Drops 14 capability columns confirmed unread anywhere in app, routes, tests, or client-new.
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

    // Rollback recreates the columns but not the pre-drop data; they come back defaulted to 'false'.
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
