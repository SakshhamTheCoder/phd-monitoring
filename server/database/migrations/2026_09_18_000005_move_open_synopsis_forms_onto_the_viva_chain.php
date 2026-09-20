<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Carry the synopsis forms already in flight onto the chain the controller now
 * builds: the DRA and the Vice Chancellor are out of it, and the DORDC ends the
 * written round rather than passing it on.
 *
 * Only incomplete rows are touched. A finished synopsis keeps the chain it
 * travelled, which is what its ladder and history should go on showing, and it
 * stays on round one because it never had a viva round to enter.
 *
 * Revise Title is served by the same controller and the same table, so its rows
 * are here too. They are the same form.
 */
return new class extends Migration
{
    private const CHAIN = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc', 'complete'];

    /**
     * Where the three removed stages send a form that is sitting on them.
     *
     * The ADORDC and the DRA both sat between the HOD and the DORDC, so a form
     * waiting on either has passed the HOD and goes on to the DORDC. The Vice
     * Chancellor sat after the DORDC, which is now the end of the written
     * round, so a form waiting on them has finished that round and starts the
     * viva round instead.
     *
     * The ADORDC is handled here rather than in the earlier migration that
     * clears them out of the other four forms: this form's chain changed twice
     * in one release, and moving it once is what keeps an interrupted run from
     * leaving it on a chain the controller no longer builds.
     */
    private const MOVED_ON = [
        'adordc' => ['stage' => 'dordc', 'round' => 1],
        'dra' => ['stage' => 'dordc', 'round' => 1],
        'director' => ['stage' => 'phd_coordinator', 'round' => 2],
    ];

    private const LOCKS = [
        'student' => 'student_lock',
        'supervisor' => 'supervisor_lock',
        'doctoral' => 'doctoral_lock',
        'phd_coordinator' => 'phd_coordinator_lock',
        'hod' => 'hod_lock',
        'dordc' => 'dordc_lock',
    ];

    public function up(): void
    {
        $rows = DB::table('synopsis_submissions')
            ->where('completion', '!=', 'complete')
            ->orWhereNull('completion')
            ->get(['id', 'stage']);

        foreach ($rows as $row) {
            $moved = self::MOVED_ON[$row->stage] ?? null;
            $stage = $moved['stage'] ?? $row->stage;

            // The supervisor's step is 'faculty' in the chain and 'supervisor'
            // everywhere a column or a stage names it.
            $index = array_search($stage === 'supervisor' ? 'faculty' : $stage, self::CHAIN, true);
            if ($index === false) {
                continue;
            }

            $update = [
                'steps' => json_encode(self::CHAIN),
                'stage' => $stage,
                'current_step' => $index,
                'maximum_step' => $index,
                'round' => $moved['round'] ?? 1,
            ];

            if ($moved && isset(self::LOCKS[$stage])) {
                $update[self::LOCKS[$stage]] = false;
                $update[$stage . '_approval'] = false;
                $update[$stage . '_comments'] = null;
            }

            // A form entering the viva round has to be answerable again by
            // everyone who confirms after it, exactly as openVivaRound() would
            // have left it had the round existed when they approved.
            if (($moved['round'] ?? 1) >= 2) {
                foreach (['supervisor', 'doctoral', 'hod'] as $role) {
                    $update[$role . '_lock'] = false;
                    $update[$role . '_approval'] = false;
                    $update[$role . '_comments'] = null;
                }
            }

            DB::table('synopsis_submissions')->where('id', $row->id)->update($update);
        }
    }

    /** Not reversible: the chain these rows came from is no longer built. */
    public function down(): void
    {
    }
};
