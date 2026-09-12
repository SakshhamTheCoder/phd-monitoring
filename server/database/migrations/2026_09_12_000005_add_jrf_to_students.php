<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a scholar holds a Junior Research Fellowship.
 *
 * It marks the scholars drawing a salary from a project's funding rather than
 * the institute's, Centres of Excellence included, which is the split the
 * office needs when it reports on funding.
 *
 * Nullable rather than defaulting to false: the institute's own sheet says a
 * PhD coordinator may fill this in later, so "nobody has said" is a real state
 * and printing "No" for it would be a claim the portal cannot make.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->boolean('is_jrf')->nullable()->after('cgpa');
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('is_jrf');
        });
    }
};
