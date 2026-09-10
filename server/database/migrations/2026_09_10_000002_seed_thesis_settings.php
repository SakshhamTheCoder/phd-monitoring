<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Seed the thesis duration limits so an admin opens Configuration on real
 * numbers. AppSetting still falls back in code, so deleting a row cannot
 * collapse a deadline to zero years.
 */
return new class extends Migration
{
    private const SETTINGS = [
        'min_years' => 3,
        'base_years_male' => 6,
        'base_years_female_ph' => 8,
    ];

    public function up(): void
    {
        foreach (self::SETTINGS as $key => $value) {
            DB::table('app_settings')->updateOrInsert(
                ['group' => 'thesis', 'key' => $key],
                ['value' => $value, 'created_at' => now(), 'updated_at' => now()]
            );
        }
    }

    public function down(): void
    {
        DB::table('app_settings')->where('group', 'thesis')->delete();
    }
};
