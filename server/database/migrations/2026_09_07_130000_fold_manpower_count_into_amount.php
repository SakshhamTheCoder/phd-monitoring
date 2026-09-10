<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Manpower lines used to cost count x amount. The count is gone, so each line's
 * amount has to absorb its multiplier or every migrated project's Manpower total
 * silently shrinks (a JRF line of 3 x 50,000 would start reading as 50,000).
 *
 * Written against the raw JSON rather than the Project model on purpose: the
 * model's accessor normalizes on read and would fold the count itself, so a
 * round-trip through it could not tell an already-migrated row from a fresh one.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('projects')->orderBy('id')->chunkById(100, function ($projects) {
            foreach ($projects as $project) {
                $budget = json_decode($project->budget ?? '', true);
                if (!is_array($budget) || !isset($budget['__manpower']) || !is_array($budget['__manpower'])) {
                    continue;
                }

                $changed = false;
                foreach ($budget['__manpower'] as $year => $lines) {
                    if (!is_array($lines)) {
                        continue;
                    }
                    foreach ($lines as $i => $line) {
                        if (!is_array($line) || !array_key_exists('count', $line)) {
                            continue;
                        }
                        $count = (int) ($line['count'] ?? 0);
                        $amount = (int) ($line['amount'] ?? 0);
                        $budget['__manpower'][$year][$i] = [
                            'category' => (string) ($line['category'] ?? ''),
                            'amount' => $amount * $count,
                        ];
                        $changed = true;
                    }
                }

                if ($changed) {
                    DB::table('projects')->where('id', $project->id)
                        ->update(['budget' => json_encode($budget)]);
                }
            }
        });
    }

    /**
     * Irreversible by design: folding 3 x 50,000 into 150,000 discards the split,
     * and any guess at a count on the way back (1, say) would change the total.
     * The amounts themselves are correct and complete without it.
     */
    public function down(): void
    {
    }
};
