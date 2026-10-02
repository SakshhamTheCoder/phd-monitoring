<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The coursework gate was once one figure per status, and those rows outlived
 * the scheme.
 *
 * `min_credits_full_time` and `min_credits_part_time` are read by nothing: the
 * requirement follows the school and the admission date now, in
 * App\Support\CourseworkRequirement. `min_credits_executive` is still read, and
 * the row left behind holds 0, which overrides the figure the regulation gives
 * and opens the synopsis to every executive candidate with no coursework at
 * all. The UGC figure is 12 to 16 credits, and the gate asks for the lower of a
 * range.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('app_settings')
            ->where('group', 'coursework')
            ->whereIn('key', ['min_credits_full_time', 'min_credits_part_time'])
            ->delete();

        DB::table('app_settings')
            ->where('group', 'coursework')
            ->where('key', 'min_credits_executive')
            ->where('value', 0)
            ->update(['value' => 12, 'updated_at' => now()]);
    }

    /**
     * Nothing to put back: the keys removed are read by no code, and a gate of
     * 0 credits is not a setting anybody chose.
     */
    public function down(): void
    {
    }
};
