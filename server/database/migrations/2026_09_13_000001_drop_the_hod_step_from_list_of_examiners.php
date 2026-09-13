<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The HOD no longer approves the List of Examiners.
 *
 * The supervisor's list now goes straight to DoRDC. Forms already in flight
 * carry their own copy of the step list, so they keep routing through a step
 * nobody acts on any more unless it is rewritten here: a form parked at 'hod'
 * would wait forever.
 *
 * current_step and maximum_step are positions in that list, so everything after
 * the removed step shifts down one. A form sitting at 'hod' (index 1) keeps
 * index 1, which is DoRDC once 'hod' is gone.
 */
return new class extends Migration
{
    public function up(): void
    {
        $forms = DB::table('list_of_examiners_forms')->select('id', 'steps', 'stage', 'current_step', 'maximum_step')->get();

        foreach ($forms as $form) {
            $steps = json_decode($form->steps ?? '[]', true) ?: [];
            $position = array_search('hod', $steps, true);
            if ($position === false) {
                continue;
            }

            DB::table('list_of_examiners_forms')->where('id', $form->id)->update([
                'steps' => json_encode(array_values(array_diff($steps, ['hod']))),
                'stage' => $form->stage === 'hod' ? 'dordc' : $form->stage,
                'current_step' => $this->shift($form->current_step, $position),
                'maximum_step' => $this->shift($form->maximum_step, $position),
            ]);
        }
    }

    public function down(): void
    {
        $forms = DB::table('list_of_examiners_forms')->select('id', 'steps', 'current_step', 'maximum_step')->get();

        foreach ($forms as $form) {
            $steps = json_decode($form->steps ?? '[]', true) ?: [];
            $position = array_search('faculty', $steps, true);
            if ($position === false || in_array('hod', $steps, true)) {
                continue;
            }

            array_splice($steps, $position + 1, 0, 'hod');

            DB::table('list_of_examiners_forms')->where('id', $form->id)->update([
                'steps' => json_encode($steps),
                'current_step' => $form->current_step > $position ? $form->current_step + 1 : $form->current_step,
                'maximum_step' => $form->maximum_step > $position ? $form->maximum_step + 1 : $form->maximum_step,
            ]);
        }
    }

    /**
     * A step at or before the removed one keeps its index; anything after it
     * moves down by one.
     */
    private function shift($index, int $position): int
    {
        $index = (int) $index;

        return $index > $position ? $index - 1 : $index;
    }
};
