<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Leave quotas, shaped like feature_flags: a string key and an integer value.
 * Seeded with the defaults so an admin sees real numbers on first open; the
 * model still falls back in code, so a deleted row cannot zero a quota.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leave_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->integer('value');
            $table->timestamps();
        });

        DB::table('leave_settings')->insert([
            ['key' => 'academic_quota', 'value' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'casual_quota', 'value' => 8, 'created_at' => now(), 'updated_at' => now()],
            ['key' => 'year_start_month', 'value' => 7, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('leave_settings');
    }
};
