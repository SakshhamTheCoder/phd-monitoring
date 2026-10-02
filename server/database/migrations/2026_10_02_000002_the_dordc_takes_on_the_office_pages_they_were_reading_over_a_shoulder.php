<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * What the DORDC may do, widened to the work they were already answering for.
 *
 * They approve the last step of every form in the portal, so the pages behind
 * those forms were the one thing they had to ask an admin to open: the clerks
 * who mark attendance, the attendance itself, the course list a scholar's
 * credits are counted from, the research areas a supervisor is matched on, the
 * supervisor records, and a form's levels.
 *
 * Manage Users, Configuration and Logs are deliberately not here. They are a
 * different kind of power and the office keeps them.
 */
return new class extends Migration
{
    private const CAPABILITIES = [
        'can_manage_clerks',
        'can_mark_attendance',
        'can_manage_supervisor_records',
        'can_manage_form_levels',
    ];

    public function up(): void
    {
        DB::table('roles')->where('role', 'dordc')
            ->update(array_fill_keys(self::CAPABILITIES, 'true'));
    }

    public function down(): void
    {
        DB::table('roles')->where('role', 'dordc')
            ->update(array_fill_keys(self::CAPABILITIES, 'false'));
    }
};
