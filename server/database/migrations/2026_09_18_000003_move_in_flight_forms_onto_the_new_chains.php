<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Carry the forms that are already in flight onto the chains their controllers
 * now use.
 *
 * A row's `steps` is written once, at creation, and `current_step` and
 * `maximum_step` are indices into that row's own array. The controllers now
 * hand forms to roles that are not in the older arrays, so without this a
 * submission would look up a step that is not there, write a nonsense index and
 * leave the form where nobody can read it or answer it.
 *
 * Only incomplete rows are touched. A finished form keeps the chain it actually
 * travelled, which is what its ladder and its history should go on showing.
 *
 * Both indices are recomputed from `stage`, which is the real cursor. That can
 * pull `maximum_step` back on a form that was sent backwards, costing a reviewer
 * above the current stage their read access until it reaches them again. It is
 * the safe direction to be wrong in, and the alternative is an index into an
 * array that no longer exists.
 */
return new class extends Migration
{
    /**
     * The step each removed role's work now falls to. The ADORDC approved
     * nothing that the DORDC does not also see, and the DRA was the last
     * approver on a supervisor change, which is now the DORDC's to finish.
     */
    private const MOVED_ON = [
        'constitute_of_irb' => ['adordc' => 'dordc'],
        'irb_sub_forms' => ['adordc' => 'dordc'],
        'thesis_submissions' => ['adordc' => 'dordc'],
        'supervisor_change_forms' => ['dra' => 'dordc'],
    ];

    private const CHAINS = [
        'constitute_of_irb' => ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'],
        'irb_sub_forms' => ['student', 'faculty', 'external', 'doctoral', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'],
        'thesis_submissions' => ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'],
        // Synopsis is not here on purpose. Its chain changed again in the same
        // release, once the viva round was added, so moving it twice would write
        // every open form onto an intermediate chain the controller does not
        // build: an interrupted run would leave them on a chain nobody can walk.
        // It is moved once, by the later migration, which is also where `round`
        // exists to be set.
        //
        // The base chain, deliberately without 'director'. A form raised under
        // the old rules should not grow a Vice Chancellor step halfway through.
        'supervisor_change_forms' => ['student', 'phd_coordinator', 'hod', 'dordc', 'complete'],
    ];

    /** The lock column to clear so the role the form lands on can answer it. */
    private const LOCKS = [
        'student' => 'student_lock',
        'supervisor' => 'supervisor_lock',
        'doctoral' => 'doctoral_lock',
        'external' => 'external_lock',
        'phd_coordinator' => 'phd_coordinator_lock',
        'hod' => 'hod_lock',
        'dra' => 'dra_lock',
        'dordc' => 'dordc_lock',
        'director' => 'director_lock',
    ];

    public function up(): void
    {
        foreach (self::CHAINS as $table => $chain) {
            $rows = DB::table($table)
                ->where('completion', '!=', 'complete')
                ->orWhereNull('completion')
                ->get(['id', 'stage']);

            foreach ($rows as $row) {
                $stage = self::MOVED_ON[$table][$row->stage] ?? $row->stage;

                // The supervisor's step is 'faculty' in the chain and
                // 'supervisor' everywhere a column or a stage names it.
                $index = array_search($stage === 'supervisor' ? 'faculty' : $stage, $chain, true);
                if ($index === false) {
                    // Nothing sensible to point at. Leave the row alone rather
                    // than write an index that is a guess.
                    continue;
                }

                $update = [
                    'steps' => json_encode($chain),
                    'stage' => $stage,
                    'current_step' => $index,
                    'maximum_step' => $index,
                ];

                // Only when the form actually moved: a row already sitting on a
                // surviving stage keeps whatever it has answered.
                if ($stage !== $row->stage && isset(self::LOCKS[$stage])) {
                    $update[self::LOCKS[$stage]] = false;
                    $update[$stage . '_approval'] = false;
                    $update[$stage . '_comments'] = null;
                }

                DB::table($table)->where('id', $row->id)->update($update);
            }
        }
    }

    /**
     * Not reversible. The old chains were replaced role by role rather than
     * archived, so there is no earlier `steps` to restore a row to, and putting
     * a form back on a stage whose submit method no longer exists would strand
     * it again.
     */
    public function down(): void
    {
    }
};
