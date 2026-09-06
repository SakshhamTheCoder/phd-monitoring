<?php

use App\Support\ProjectBudget;
use App\Support\ProjectObjectives;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Rewrite existing project budgets and objectives into the shapes the module
 * now reads. The accessors on the model normalize on read anyway, so this is
 * about the stored rows agreeing with what everyone sees, and about the
 * conversion happening once rather than on every request.
 *
 * Nothing is dropped: ProjectBudget::normalize carries every legacy amount
 * forward, including a category the menu no longer offers.
 */
return new class extends Migration {
    public function up(): void {
        DB::table('projects')->orderBy('id')->chunkById(100, function ($projects) {
            foreach ($projects as $project) {
                DB::table('projects')->where('id', $project->id)->update([
                    'budget' => json_encode(ProjectBudget::normalize(json_decode($project->budget ?? 'null', true))),
                    'objectives' => json_encode(ProjectObjectives::normalize(json_decode($project->objectives ?? 'null', true))),
                ]);
            }
        });
    }

    public function down(): void {
        // The legacy shape cannot be reconstructed from the normalized one, and
        // the normalized one reads correctly either way. Nothing to undo.
    }
};
