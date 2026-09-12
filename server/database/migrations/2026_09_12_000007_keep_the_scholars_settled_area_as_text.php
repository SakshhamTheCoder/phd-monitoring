<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Turns the scholar's settled research area back into words.
 *
 * It was a link into the curated list. Three things read it and all three only
 * print a name: the IRB listing, the broad area column on the semester student
 * lists that feeds the bulk schedule export, and the Domain line on the profile.
 * No join, no filter, no rule depends on it being an id.
 *
 * Being an id had a cost, though. The IRB form would only accept an area the
 * department had already been given, and a department with three areas on
 * record would have stopped its scholars constituting an IRB until an admin
 * added theirs. The form had always been free text with suggestions; making it
 * a strict choice was a change nobody asked for.
 *
 * `area_of_specializations` is left to the one job that does need a fixed
 * vocabulary: the broad area a faculty member is listed under, which the
 * institute's matrix sheet supplies.
 *
 * The two scholars already linked keep their area, as its name.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('broad_area')->nullable()->after('department_id');
        });

        DB::statement('
            UPDATE students s
            JOIN area_of_specializations a ON a.id = s.area_of_specialization_id
            SET s.broad_area = a.name
        ');

        Schema::table('students', function (Blueprint $table) {
            $table->dropForeign(['area_of_specialization_id']);
            $table->dropColumn('area_of_specialization_id');
        });
    }

    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->unsignedBigInteger('area_of_specialization_id')->nullable()->after('department_id');
            $table->foreign('area_of_specialization_id')
                ->references('id')->on('area_of_specializations')->nullOnDelete();
        });

        // Only an area the department actually offers can become a link again.
        DB::statement('
            UPDATE students s
            JOIN area_of_specializations a
              ON a.department_id = s.department_id AND a.name = s.broad_area
            SET s.area_of_specialization_id = a.id
        ');

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('broad_area');
        });
    }
};
