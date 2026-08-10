<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feature_flags', function (Blueprint $table) {
            $table->string('key', 64)->primary();
            $table->boolean('enabled')->default(true);
            $table->timestamps();
        });

        // Seeded on so deploying this changes nothing. A missing row also reads
        // as enabled, so the switch can only ever be used to turn something off.
        $now = now();
        DB::table('feature_flags')->insert([
            ['key' => 'research_profile', 'enabled' => true, 'created_at' => $now, 'updated_at' => $now],
            ['key' => 'job_openings', 'enabled' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('feature_flags');
    }
};
