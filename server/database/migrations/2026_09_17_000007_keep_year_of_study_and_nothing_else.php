<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Year of study is the answer people give, so it is the one kept. Deriving it
 * from a year of admission left two places for the same answer to disagree.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::statement('UPDATE ug_students SET year = LEAST(4, GREATEST(1, YEAR(CURDATE()) - (MONTH(CURDATE()) < 7) - admission_year + 1)) WHERE year IS NULL AND admission_year IS NOT NULL');
        DB::table('ug_students')->whereNull('year')->update(['year' => 1]);

        Schema::table('ug_students', function (Blueprint $table) {
            $table->dropColumn('admission_year');
            $table->unsignedTinyInteger('year')->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('ug_students', function (Blueprint $table) {
            $table->unsignedSmallInteger('admission_year')->nullable()->after('branch_id');
            $table->unsignedTinyInteger('year')->nullable()->change();
        });

        DB::statement('UPDATE ug_students SET admission_year = YEAR(CURDATE()) - (MONTH(CURDATE()) < 7) - year + 1');
    }
};
