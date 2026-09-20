<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Every IRB constitution that was completed before the status was being set.
 *
 * `ConstituteOfIRBController::dordcSubmit` marked the form complete but never
 * marked it approved, and `Student::irbCompleted()` reads the status. So a
 * scholar whose IRB was constituted in the portal still counted as pre-IRB:
 * their title read as tentative and the supervisor change form refused to open
 * and sent them to the direct edit instead.
 *
 * The controller now sets it. These are the rows that went through before it
 * did. Completion is the evidence: the DORDC is the last step of that chain, so
 * a complete form is an approved one.
 */
return new class extends Migration
{
    public function up(): void
    {
        $updated = DB::table('constitute_of_irb')
            ->where('completion', 'complete')
            ->where(function ($query) {
                $query->where('status', '!=', 'approved')->orWhereNull('status');
            })
            ->update(['status' => 'approved']);

        // Left in the log rather than silent: this changes what irbCompleted()
        // answers for these scholars, which opens forms that were refused.
        \Illuminate\Support\Facades\Log::info("Marked {$updated} completed IRB constitutions as approved");
    }

    /**
     * Not reversed. The previous value was not a decision anybody made, it was
     * whatever the last transition happened to leave behind.
     */
    public function down(): void
    {
    }
};
