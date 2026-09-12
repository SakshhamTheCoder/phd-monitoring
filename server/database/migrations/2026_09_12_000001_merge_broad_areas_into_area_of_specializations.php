<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Separates what a scholar hopes to work on from what a department offers.
 *
 * These were tangled together. `broad_area_specializations` looked like a list
 * of a department's research areas, but it was written by the supervisor
 * allocation form: every time a scholar typed an area, a row appeared. That pile
 * then fed the autocomplete on three separate forms, so one scholar's typing
 * became everyone else's suggestions, and it filled with near duplicates -
 * "wastewater treatment" eight times in one department.
 *
 * The two are different things and now live apart.
 *
 * A scholar's allocation preferences are their own words, kept as text against
 * their record. They are an aspiration written before a supervisor exists, and
 * the only thing that reads them is the faculty recommender. Nothing about them
 * is a statement of what the department offers, so they no longer become one.
 *
 * `area_of_specializations` stays what it already was: the curated list an admin
 * maintains, which the institute's matrix sheet fills. It is what the faculty
 * broad area and the scholar's settled IRB area are chosen from.
 *
 * Also dropped: `students.tentative_broad_area` and
 * `constitute_of_irb.broad_area_of_research`, two more free text copies of the
 * same idea that were connected to nothing.
 *
 * Reversible with one stated limit: down() restores the tables and columns and
 * every preference, but an IRB area that was matched to a curated area cannot
 * be recovered as the string it was, so that column comes back empty.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->keepPreferencesAsText();
        $this->linkSettledIrbAreas();

        Schema::dropIfExists('broad_area_specializations');

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('tentative_broad_area');
        });

        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->dropColumn('broad_area_of_research');
        });
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
            $table->text('tentative_broad_area')->nullable()->after('tentative_desc');
        });

        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->text('broad_area_of_research')->nullable()->after('irb_pdf');
        });

        // Rebuild the old list from the preferences that came out of it, then
        // point the link table back at it.
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

        Schema::table('student_area_preferences', function (Blueprint $table) {
            $table->dropColumn('broad_area');
        });

        Schema::rename('student_area_preferences', 'student_broad_area_specializations');

        Schema::table('student_broad_area_specializations', function (Blueprint $table) {
            $table->foreign('specialization_id')
                ->references('id')->on('broad_area_specializations')->onDelete('cascade');
        });
    }

    /**
     * Flatten the scholar's preferences into their own words.
     *
     * The link table pointed at rows in the pile, and the pile is going away.
     * The scholar's text is the part worth keeping, so it moves onto the
     * preference row itself and the two tables become one.
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

        $this->removeDuplicatePreferences();
    }

    /**
     * A scholar could pick two spellings of the same thing from the old
     * autocomplete, which now collapse into the same words.
     */
    private function removeDuplicatePreferences(): void
    {
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

    /**
     * Move the IRB form's broad area onto the scholar's record, where it is a
     * link into the curated list rather than a string.
     *
     * Unlike the allocation preferences this one is settled: it is the area the
     * scholar is actually working in, stated when the IRB is constituted. Text
     * that matches nothing on the curated list is left unlinked and written to
     * the log, because inventing a department's research area from one scholar's
     * wording is how the old pile started.
     */
    private function linkSettledIrbAreas(): void
    {
        $areas = [];
        foreach (DB::table('area_of_specializations')->get() as $area) {
            $areas[$this->key($area->department_id, $area->name)] = $area->id;
        }

        $unmatched = [];

        $forms = DB::table('constitute_of_irb')
            ->whereNotNull('broad_area_of_research')
            ->orderBy('id')
            ->get(['student_id', 'broad_area_of_research']);

        foreach ($forms as $form) {
            $value = trim((string) $form->broad_area_of_research);
            if ($value === '') {
                continue;
            }

            $student = DB::table('students')->where('roll_no', $form->student_id)->first();
            if (!$student) {
                continue;
            }

            // The IRB form accepted an area id as well as text, and stored the
            // link only when the value happened to be numeric.
            $areaId = ctype_digit($value)
                ? DB::table('area_of_specializations')->where('id', $value)->value('id')
                : ($areas[$this->key($student->department_id, $value)] ?? null);

            if (!$areaId) {
                $unmatched[] = $student->roll_no . ': ' . $value;
                continue;
            }

            DB::table('students')->where('roll_no', $student->roll_no)
                ->update(['area_of_specialization_id' => $areaId]);
        }

        if ($unmatched) {
            file_put_contents(
                storage_path('logs/area-merge.log'),
                now()->toDateTimeString() . " IRB areas matching nothing on the curated list:\n"
                    . implode("\n", $unmatched) . "\n",
                FILE_APPEND
            );
        }
    }

    /**
     * Case, spacing and punctuation differ far more often than meaning.
     */
    private function key(?int $departmentId, ?string $name): string
    {
        $normalised = strtolower(trim(preg_replace('/[^a-z0-9]+/i', ' ', (string) $name)));

        return $departmentId . '|' . preg_replace('/\s+/', ' ', $normalised);
    }
};
