<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One table for every admin-editable setting, shaped like feature_flags but
 * grouped: the group column carries what a per-feature table name would have.
 *
 * Seeded with the leave defaults so an admin sees real numbers on first open;
 * AppSetting still falls back in code, so a deleted row cannot zero a quota.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('app_settings', function (Blueprint $table) {
            $table->id();
            $table->string('group');
            $table->string('key');
            $table->integer('value');
            $table->timestamps();
            $table->unique(['group', 'key']);
        });

        DB::table('app_settings')->insert([
            ['group' => 'leave', 'key' => 'academic_quota', 'value' => 10, 'created_at' => now(), 'updated_at' => now()],
            ['group' => 'leave', 'key' => 'casual_quota', 'value' => 8, 'created_at' => now(), 'updated_at' => now()],
            ['group' => 'leave', 'key' => 'year_start_month', 'value' => 7, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('app_settings');
    }
};
