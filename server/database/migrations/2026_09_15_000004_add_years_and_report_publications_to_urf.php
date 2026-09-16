<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Two things the URF sheets ask for that the first tables lacked.
 *
 *  - The year of study of each student on a project (1st to 4th).
 *  - Publications on the half-yearly and final reports. A report links them
 *    the way a PhD progress form does: a copy of each chosen library entry,
 *    tagged with the report's id and the form type 'urf_report'.
 */
return new class extends Migration
{
    private const FORM_TYPES = ['progress', 'thesis', 'synopsis'];

    public function up(): void
    {
        Schema::table('urf_applications', function (Blueprint $table) {
            $table->unsignedTinyInteger('student1_year')->nullable()->after('student1_department_id');
            $table->unsignedTinyInteger('student2_year')->nullable()->after('student2_department_id');
        });

        foreach (['publications', 'patents'] as $name) {
            Schema::table($name, function (Blueprint $table) {
                $table->enum('form_type', [...self::FORM_TYPES, 'urf_report'])->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        foreach (['publications', 'patents'] as $name) {
            // The copies linked to URF reports have no place in the narrower enum.
            DB::table($name)->where('form_type', 'urf_report')->delete();
            Schema::table($name, function (Blueprint $table) {
                $table->enum('form_type', self::FORM_TYPES)->nullable()->change();
            });
        }

        Schema::table('urf_applications', function (Blueprint $table) {
            $table->dropColumn(['student1_year', 'student2_year']);
        });
    }
};
