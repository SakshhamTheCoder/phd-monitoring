<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * A role taken out of a form's chain stops seeing that form.
 *
 * `steps` is what grants reading: GeneralFormList lists a form to anybody whose
 * step is in the row's own array and has been reached. Earlier migrations moved
 * the forms that were still in flight, and left the finished ones alone so they
 * would keep the chain they actually travelled. The side effect was that a DRA
 * went on being listed every synopsis they had ever answered, and would now be
 * refused when opening one, because their case has come out of loadForm().
 *
 * So the retired roles come out of the finished rows too. Rather than impose the
 * current chain, which would show a completed supervisor change a DORDC step it
 * never had, this removes only the named roles and leaves the rest of each row's
 * chain as it was.
 *
 * **What this costs.** A finished form no longer draws a panel for the role that
 * left, so the recommendation and comment they gave stop being visible on the
 * ladder. The columns still hold them, and the form's history still names who
 * approved and when, which is the record that matters. Nothing is deleted.
 */
return new class extends Migration
{
    /** Table => the roles that no longer belong to that form. */
    private const RETIRED = [
        'constitute_of_irb' => ['adordc'],
        'irb_sub_forms' => ['adordc'],
        'thesis_submissions' => ['adordc'],
        'synopsis_submissions' => ['adordc', 'dra', 'director'],
        'supervisor_change_forms' => ['dra'],
        'presentations' => ['adordc'],
    ];

    public function up(): void
    {
        // Presentations were never moved by the earlier migrations, so any that
        // are sitting on the ADORDC have to go forward before that stage stops
        // being answerable.
        DB::table('presentations')
            ->where('stage', 'adordc')
            ->update(['stage' => 'dordc', 'dordc_lock' => false, 'dordc_approval' => false, 'dordc_comments' => null]);

        foreach (self::RETIRED as $table => $retired) {
            foreach (DB::table($table)->get(['id', 'stage', 'steps', 'current_step']) as $row) {
                $steps = json_decode((string) $row->steps, true);
                if (!is_array($steps)) {
                    continue;
                }

                $kept = array_values(array_diff($steps, $retired));
                if ($kept === $steps) {
                    continue;
                }

                // The supervisor's step is 'faculty' in the chain and
                // 'supervisor' wherever a stage or a column names it.
                $stage = $row->stage === 'supervisor' ? 'faculty' : $row->stage;
                $index = array_search($stage, $kept, true);
                if ($index === false) {
                    // The row is parked on a stage that is no longer in its own
                    // chain. Leaving the indices alone is safer than guessing;
                    // the in-flight migrations have already moved the rows that
                    // needed moving.
                    $index = max(0, count($kept) - 1);
                }

                DB::table($table)->where('id', $row->id)->update([
                    'steps' => json_encode($kept),
                    'current_step' => min((int) $row->current_step, $index),
                    'maximum_step' => $index,
                ]);
            }
        }
    }

    /** Not reversible: the removed steps are not recorded anywhere to put back. */
    public function down(): void
    {
    }
};
