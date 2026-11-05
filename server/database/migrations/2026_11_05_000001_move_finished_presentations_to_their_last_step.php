<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Evaluations imported from the progress sheet were left at step 0 although
 * they are complete, so every role holding a step (DORDC, HoD, coordinator,
 * committee) was shown none of them: the lists only show a form once the
 * reader's step has been reached. This moves each finished presentation to the
 * last step of its own chain. Nothing else about the rows changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        $last = "CAST(REPLACE(REPLACE(JSON_UNQUOTE(JSON_SEARCH(steps, 'one', 'complete')), '\$[', ''), ']', '') AS UNSIGNED)";

        DB::statement(
            "UPDATE presentations SET current_step = {$last}, maximum_step = {$last} "
            . "WHERE completion = 'complete' AND JSON_SEARCH(steps, 'one', 'complete') IS NOT NULL "
            . "AND maximum_step < {$last}"
        );
    }

    public function down(): void
    {
        // The earlier step was an accident of the import; there is nothing to restore.
    }
};
