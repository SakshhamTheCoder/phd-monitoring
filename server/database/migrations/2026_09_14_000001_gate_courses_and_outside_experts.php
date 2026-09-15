<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Grants can_manage_courses/can_read_external/can_edit_external so course and outside-expert endpoints are actually gated.
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
