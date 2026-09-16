<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/** Year of study goes stale every July; the year admitted does not. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ug_students', function (Blueprint $table) {
            $table->unsignedSmallInteger('admission_year')->nullable()->after('branch_id');
            $table->unsignedTinyInteger('year')->nullable()->change();
        });

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
