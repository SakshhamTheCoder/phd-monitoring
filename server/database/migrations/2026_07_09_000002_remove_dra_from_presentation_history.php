<?php

use App\Models\Presentation;
use Illuminate\Database\Migrations\Migration;

/**
 * Scrub DRA references out of already-submitted presentation history logs (the
 * "Form Status" timeline). DRA was removed from the workflow and DoRDC is now the
 * terminal approver, so for existing rows:
 *   - drop the DRA approval entry  ("... (DRA) submitted/Rejected the form"), and
 *   - relabel the completion entry ("... completed by DRA" -> "... by DoRDC")
 * so historical forms read exactly like ones completed under the new workflow.
 *
 * Matching is precise (role tag "(DRA)" / the exact completion string) so names
 * that merely contain the letters "dra" are never touched. Irreversible.
 */
return new class extends Migration
{
    public function up(): void
    {
        Presentation::query()->chunkById(200, function ($rows) {
            foreach ($rows as $form) {
                $history = $form->history;
                if (!is_array($history) || empty($history)) {
                    continue;
                }

                $changed = false;
                $cleaned = [];
                foreach ($history as $entry) {
                    $action = is_array($entry) ? ($entry['action'] ?? '') : '';

                    // Drop the DRA approval/rejection step — it no longer exists.
                    if (preg_match('/\(DRA\) (submitted|Rejected) the form$/', $action)) {
                        $changed = true;
                        continue;
                    }

                    // Relabel the old completion message to the new terminal approver.
                    if ($action === 'Presentation marked as completed by DRA') {
                        $entry['action'] = 'Presentation marked as completed by DoRDC';
                        $changed = true;
                    }

                    $cleaned[] = $entry;
                }

                if ($changed) {
                    $form->history = array_values($cleaned);
                    $form->save();
                }
            }
        });
    }

    public function down(): void
    {
        // Irreversible — removed DRA history entries are not restored.
    }
};
