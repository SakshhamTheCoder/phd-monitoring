<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * The research profile became the faculty profile: the dashboard renders it for
 * every signed-in faculty member and always did so ungated, so the switch only
 * ever decided whether you could open somebody else's. That is not what its name
 * said, and it is not a module anyone expects to turn off.
 *
 * The row goes with the flag. FeatureFlag::map() reads FLAGS, so a row left
 * behind would answer for a key nothing asks about.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('feature_flags')->where('key', 'research_profile')->delete();
    }

    public function down(): void
    {
        $now = now();

        DB::table('feature_flags')->updateOrInsert(
            ['key' => 'research_profile'],
            ['enabled' => true, 'created_at' => $now, 'updated_at' => $now]
        );
    }
};
