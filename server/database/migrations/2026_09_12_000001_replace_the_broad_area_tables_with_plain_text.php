<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Separates what a scholar writes about their research from what a department
 * offers.
 *
 * These were tangled. `broad_area_specializations` looked like a department's
 * list of research areas, but the supervisor allocation form wrote it: every
 * time a scholar typed an area, a row appeared. That pile then fed the
 * autocomplete on three separate forms, so one scholar's spelling became a
 * suggestion shown to everyone else, and it filled with near duplicates -
 * "wastewater treatment" eight times in one department.
 *
 * Everything a scholar writes about their own research is now plain text on
 * their own record: up to three areas they would like to work in, from the
 * allocation form, and one settled area from the IRB form. Nothing they type
 * changes what their department offers.
 *
 * Three more copies of the same idea go with it. `students.tentative_broad_area`
 * and `constitute_of_irb.broad_area_of_research` were loose text connected to
 * nothing, and `students.area_of_specialization_id` was a link the IRB form only
 * ever wrote when the submitted value happened to be numeric, which it never
 * was. Everything that reads the settled area only prints a name.
 *
 * `area_of_specializations` is untouched and keeps the one job that needs a
 * fixed vocabulary: the broad area a faculty member is listed under, which the
 * institute's matrix sheet supplies.
 *
 * Reversible, with the limit that a scholar's words cannot be told apart from
 * an area a department offered once they are text, so down() rebuilds the old
 * list from what the scholars wrote.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $table->string('broad_area')->nullable()->after('department_id');
        });

        // The settled area, from whichever of the three places held it. The IRB
        // form is applied last because it is the most recent statement.
        DB::statement('
            UPDATE students s
            JOIN area_of_specializations a ON a.id = s.area_of_specialization_id
            SET s.broad_area = a.name
        ');

        DB::statement("
            UPDATE students s
            SET s.broad_area = TRIM(s.tentative_broad_area)
            WHERE s.broad_area IS NULL AND TRIM(COALESCE(s.tentative_broad_area, '')) <> ''
        ");

        DB::statement("
            UPDATE students s
            JOIN constitute_of_irb i ON i.student_id = s.roll_no
            SET s.broad_area = TRIM(i.broad_area_of_research)
            WHERE TRIM(COALESCE(i.broad_area_of_research, '')) <> ''
              AND i.broad_area_of_research NOT REGEXP '^[0-9]+$'
        ");

        $this->keepPreferencesAsText();

        Schema::table('students', function (Blueprint $table) {
            $table->dropForeign(['area_of_specialization_id']);
            $table->dropColumn(['area_of_specialization_id', 'tentative_broad_area']);
        });

        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->dropColumn('broad_area_of_research');
        });

        Schema::dropIfExists('broad_area_specializations');
    }

    public function down(): void
    {
        Schema::create('broad_area_specializations', function (Blueprint $table) {
            $table->increments('id');
            $table->string('broad_area');
            $table->integer('department_id')->unsigned()->index();
            $table->foreign('department_id')->references('id')->on('departments')->onDelete('cascade');
            $table->timestamps();
        });

        Schema::table('students', function (Blueprint $table) {
            $table->unsignedBigInteger('area_of_specialization_id')->nullable()->after('department_id');
            $table->foreign('area_of_specialization_id')
                ->references('id')->on('area_of_specializations')->nullOnDelete();
            $table->text('tentative_broad_area')->nullable()->after('tentative_desc');
        });

        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->text('broad_area_of_research')->nullable()->after('irb_pdf');
        });

        DB::statement('
            UPDATE students s
            JOIN area_of_specializations a
              ON a.department_id = s.department_id AND a.name = s.broad_area
            SET s.area_of_specialization_id = a.id
        ');

        $this->restorePreferenceLinks();

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('broad_area');
        });
    }

    /**
     * Flatten the preferences into the scholar's own words.
     *
     * The link table pointed at rows in the pile, and the pile is going away.
     * The words are the part worth keeping, so they move onto the preference row
     * and the two tables become one.
     */
    private function keepPreferencesAsText(): void
    {
        Schema::table('student_broad_area_specializations', function (Blueprint $table) {
            $table->dropForeign(['specialization_id']);
            $table->string('broad_area')->nullable()->after('student_id');
        });

        DB::statement('
            UPDATE student_broad_area_specializations p
            JOIN broad_area_specializations b ON b.id = p.specialization_id
            SET p.broad_area = b.broad_area
        ');

        // A preference whose area row has already gone says nothing.
        DB::table('student_broad_area_specializations')->whereNull('broad_area')->delete();

        Schema::table('student_broad_area_specializations', function (Blueprint $table) {
            $table->dropColumn('specialization_id');
        });

        DB::statement('ALTER TABLE student_broad_area_specializations MODIFY broad_area VARCHAR(255) NOT NULL');

        Schema::rename('student_broad_area_specializations', 'student_area_preferences');

        // A scholar could pick two spellings of the same thing from the old
        // autocomplete, which now collapse into the same words.
        $duplicates = DB::table('student_area_preferences')
            ->selectRaw('MIN(id) as keep_id, student_id, broad_area')
            ->groupBy('student_id', 'broad_area')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            DB::table('student_area_preferences')
                ->where('student_id', $duplicate->student_id)
                ->where('broad_area', $duplicate->broad_area)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
        }
    }

    private function restorePreferenceLinks(): void
    {
        Schema::table('student_area_preferences', function (Blueprint $table) {
            $table->integer('specialization_id')->unsigned()->nullable()->after('student_id');
        });

        foreach (DB::table('student_area_preferences')->get() as $preference) {
            $departmentId = DB::table('students')->where('roll_no', $preference->student_id)->value('department_id');
            if (!$departmentId) {
                continue;
            }

            $areaId = DB::table('broad_area_specializations')
                ->where('department_id', $departmentId)
                ->where('broad_area', $preference->broad_area)
                ->value('id')
                ?? DB::table('broad_area_specializations')->insertGetId([
                    'broad_area' => $preference->broad_area,
                    'department_id' => $departmentId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);

            DB::table('student_area_preferences')->where('id', $preference->id)
                ->update(['specialization_id' => $areaId]);
        }

        DB::table('student_area_preferences')->whereNull('specialization_id')->delete();

        Schema::table('student_area_preferences', function (Blueprint $table) {
            $table->dropColumn('broad_area');
        });

        Schema::rename('student_area_preferences', 'student_broad_area_specializations');

        Schema::table('student_broad_area_specializations', function (Blueprint $table) {
            $table->foreign('specialization_id')
                ->references('id')->on('broad_area_specializations')->onDelete('cascade');
        });
    }
};
