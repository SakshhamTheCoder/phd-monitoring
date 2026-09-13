<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Gives a faculty member one broad area from their department's list.
 *
 * `faculty.expertise` already holds their specific areas, but it is free text
 * and not department scoped, so there was nothing to match a scholar's chosen
 * area against except the strings themselves. The institute's own supervisor
 * sheet asks for the two separately: one broad area from a fixed per-department
 * list, then free-hand specifics under it. This is the broad one; expertise
 * stays as the specifics.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            $table->unsignedBigInteger('area_of_specialization_id')->nullable()->after('department_id');
            $table->foreign('area_of_specialization_id')
                ->references('id')->on('area_of_specializations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('faculty', function (Blueprint $table) {
            $table->dropForeign(['area_of_specialization_id']);
            $table->dropColumn('area_of_specialization_id');
        });
    }
};
