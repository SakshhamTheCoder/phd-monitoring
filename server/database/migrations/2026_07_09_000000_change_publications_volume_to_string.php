<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Volume can hold non-numeric values (e.g. "3A", roman numerals, ranges), so the
 * integer constraint was wrong. Widen the existing column to a nullable string on
 * databases that already ran the create migration (the create migration itself has
 * been corrected to string for fresh builds).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('publications', function (Blueprint $table) {
            $table->string('volume')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('publications', function (Blueprint $table) {
            $table->integer('volume')->nullable()->change();
        });
    }
};
