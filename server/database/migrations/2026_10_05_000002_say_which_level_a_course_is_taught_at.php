<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which level a course is taught at, so the eight masters level courses a
 * B.E. or B.Tech entrant owes can be counted.
 *
 * Nullable with no default: a course nobody has classified is unknown, not
 * doctoral. The requirement stays at zero until the office has marked some
 * courses, so no scholar is held back by a column that has never been filled.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->enum('level', ['masters', 'doctoral'])->nullable()->after('credits');
        });
    }

    public function down(): void
    {
        Schema::table('courses', function (Blueprint $table) {
            $table->dropColumn('level');
        });
    }
};
