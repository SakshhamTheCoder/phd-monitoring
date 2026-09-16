<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Year of study goes stale every July; the year a student was admitted does
 * not. The institute address carries it already (be23 is 2023), so that is
 * what is kept, and the year of study and the semester are worked out against
 * the current term whenever they are asked for.
 *
 * `year` stays as the answer for anyone off the usual cycle, a year out or a
 * transfer, and is null for everyone else.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ug_students', function (Blueprint $table) {
            $table->unsignedSmallInteger('admission_year')->nullable()->after('branch_id');
            $table->unsignedTinyInteger('year')->nullable()->change();
        });

        // The year already given says which year of study they were in when
        // they signed up, so it dates the admission.
        DB::statement('UPDATE ug_students SET admission_year = YEAR(created_at) - year + 1 WHERE admission_year IS NULL AND year IS NOT NULL');
        DB::table('ug_students')->update(['year' => null]);
    }

    public function down(): void
    {
        DB::statement('UPDATE ug_students SET year = YEAR(created_at) - admission_year + 1 WHERE year IS NULL AND admission_year IS NOT NULL');
        DB::table('ug_students')->whereNull('year')->update(['year' => 1]);

        Schema::table('ug_students', function (Blueprint $table) {
            $table->dropColumn('admission_year');
            $table->unsignedTinyInteger('year')->nullable(false)->change();
        });
    }
};
