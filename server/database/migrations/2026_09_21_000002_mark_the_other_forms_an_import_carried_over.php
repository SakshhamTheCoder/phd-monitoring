<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The same mark the IRB constitution already carries, on the other four forms
 * the students import can stand in for.
 *
 * The office's sheet records a scholar's milestones as dates and filled
 * columns: supervisors named means they were allocated, a date of IRB means the
 * IRB was constituted and submitted, a date of synopsis or thesis means that
 * was submitted. Each of those becomes a form here, because the portal opens
 * the next form off the last one finishing, not off a date column.
 *
 * A timestamp rather than a flag, matching constitute_of_irb: when it was
 * carried over is worth keeping and costs nothing over a boolean.
 */
return new class extends Migration
{
    private const TABLES = [
        'supervisor_allocation_form',
        'irb_sub_forms',
        'synopsis_submissions',
        'thesis_submissions',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->timestamp('carried_over_at')->nullable();
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn('carried_over_at');
            });
        }
    }
};
