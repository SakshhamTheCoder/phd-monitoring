<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * `doctoral` and `external` could create students and faculty.
 *
 * Both are review roles: a doctoral committee member and an outside expert sit
 * on a form, they do not provision accounts. Nobody noticed because the guards
 * reading these columns never fired, so the values had no effect until they
 * were fixed.
 */
return new class extends Migration
{
    private const ROLES = ['doctoral', 'external'];

    public function up(): void
    {
        DB::table('roles')->whereIn('role', self::ROLES)->update([
            'can_add_students' => 'false',
            'can_add_faculties' => 'false',
        ]);
    }

    public function down(): void
    {
        DB::table('roles')->whereIn('role', self::ROLES)->update([
            'can_add_students' => 'true',
            'can_add_faculties' => 'true',
        ]);
    }
};
