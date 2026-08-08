<?php

use App\Models\Presentation;
use Illuminate\Database\Migrations\Migration;

/**
 * The DRA approval step was removed from the presentation (progress monitoring)
 * workflow; DoRDC is now the terminal approver. Bring already-submitted forms in
 * line with the new workflow:
 *   - drop 'dra' from each row's stored steps array;
 *   - any form sitting AT the DRA step (DoRDC already approved it) is completed,
 *     mirroring the new dordcSubmit completion side-effects;
 *   - re-index current_step / maximum_step against the shortened steps array so
 *     the progress display stays correct.
 *
 * Data migration only — irreversible (down() is a no-op).
 */
return new class extends Migration
{
    public function up(): void
    {
        Presentation::query()->chunkById(200, function ($rows) {
            foreach ($rows as $form) {
                $steps = $form->steps;
                if (!is_array($steps)) {
                    continue;
                }

                $newSteps = array_values(array_filter($steps, fn ($s) => $s !== 'dra'));

                // Form awaiting the (now removed) DRA step → DoRDC's approval is
                // terminal, so complete it exactly as dordcSubmit now would.
                if ($form->stage === 'dra') {
                    $completeIdx = array_search('complete', $newSteps, true);
                    $form->steps        = $newSteps;
                    $form->stage        = 'complete';
                    $form->completion   = 'complete';
                    $form->status       = 'approved';
                    $form->current_step = $completeIdx !== false ? $completeIdx : $form->current_step;
                    $form->maximum_step = $completeIdx !== false ? $completeIdx : $form->maximum_step;

                    if ($form->student) {
                        $form->student->overall_progress = $form->total_progress;
                        $form->student->save();
                    }

                    $form->addHistoryEntry('Presentation marked as completed (DRA step removed)', 'system');
                    $form->save();
                    continue;
                }

                // Otherwise just drop 'dra' and re-index the step pointers.
                $newCur = array_search($form->stage, $newSteps, true);
                if ($newCur === false) {
                    $newCur = $form->current_step;
                }

                $oldMaxName = $steps[$form->maximum_step] ?? null;
                $newMax = $oldMaxName !== null ? array_search($oldMaxName, $newSteps, true) : false;
                if ($newMax === false) {
                    // Old maximum pointed at the removed 'dra' (reached DRA then
                    // returned) — the furthest equivalent step is now DoRDC.
                    $newMax = array_search('dordc', $newSteps, true);
                    if ($newMax === false) {
                        $newMax = $newCur;
                    }
                }

                $form->steps        = $newSteps;
                $form->current_step = $newCur;
                $form->maximum_step = max($newMax, $newCur);
                $form->save();
            }
        });
    }

    public function down(): void
    {
        // Irreversible data migration — the removed DRA step is not restored.
    }
};
