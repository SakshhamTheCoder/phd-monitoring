<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two changes to who may do what, which belong together.
 *
 * **The DORDC is the office.** They were switching to an admin role to open
 * Manage Users, Configuration, the logs and the outside expert directory, which
 * is a login and a role switch to do work that is theirs. Every capability the
 * admin role holds is now theirs as well, and `config/navigation.php` gives them
 * the pages to match.
 *
 * **The office answers a step that has stalled.** `can_approve_any_step` is new
 * and is the one thing the DORDC does *not* get. A chain stops dead when the
 * holder of a step has left the institute or has no record behind their role,
 * and the only way through was to move the form's stage by hand, which reads
 * afterwards as though that step was answered when nobody answered it. With this
 * capability the admin answers the step the form is actually waiting on, as that
 * step, and the history names who answered. It covers the office chain only:
 * coordinator, head, DRA, DORDC and director. The scholar's own step, their
 * supervisor's, their committee's and the outside expert's are nobody else's to
 * answer.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            $table->enum('can_approve_any_step', ['true', 'false'])->default('false');
        });

        DB::table('roles')->where('role', 'admin')->update(['can_approve_any_step' => 'true']);

        $admin = (array) DB::table('roles')->where('role', 'admin')->first();
        $office = collect($admin)
            ->filter(fn ($value, $column) => str_starts_with($column, 'can_') && $value === 'true')
            ->keys()
            ->reject(fn ($column) => $column === 'can_approve_any_step')
            ->all();

        DB::table('roles')->where('role', 'dordc')->update(array_fill_keys($office, 'true'));
    }

    public function down(): void
    {
        $admin = (array) DB::table('roles')->where('role', 'admin')->first();
        $granted = collect($admin)
            ->filter(fn ($value, $column) => str_starts_with($column, 'can_') && $value === 'true')
            ->keys()
            // What the DORDC held before this migration, which it keeps.
            ->reject(fn ($column) => in_array($column, [
                'can_approve_any_step',
                'can_manage_clerks',
                'can_mark_attendance',
                'can_manage_supervisor_records',
                'can_manage_form_levels',
            ], true))
            ->all();

        DB::table('roles')->where('role', 'dordc')->update(array_fill_keys($granted, 'false'));

        Schema::table('roles', function (Blueprint $table) {
            $table->dropColumn('can_approve_any_step');
        });
    }
};
