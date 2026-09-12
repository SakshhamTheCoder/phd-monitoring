<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Collapses four representations of "a broad research area" into one.
 *
 * The portal grew two lists of the same thing. `area_of_specializations` is the
 * curated one: a department plus an area name, maintained by admins on
 * /areasOfSpecialization, and the row the DoRDC reads to pull an outside expert
 * onto a doctoral committee. `broad_area_specializations` is the accidental one:
 * the supervisor allocation form inserted a row every time a scholar typed an
 * area that was not already an id, so it filled with duplicates and near
 * duplicates, and those fed the autocomplete on three separate forms.
 *
 * Two more copies existed as loose text: `students.tentative_broad_area` (the
 * profile "Domain") and `constitute_of_irb.broad_area_of_research`. Neither was
 * connected to either list, so the same area was spelled differently in four
 * places and the faculty recommender had nothing better to match on than the
 * strings themselves.
 *
 * After this, `area_of_specializations` is the only list. A scholar keeps up to
 * three preferences on it through the renamed link table, and one settled area
 * through `students.area_of_specialization_id`.
 *
 * Reversible with one stated limit: down() restores the tables, the columns and
 * every link row, but the free text that was matched to an area cannot be
 * recovered from the id it became, so `tentative_broad_area` and
 * `broad_area_of_research` come back empty.
 */
return new class extends Migration
{
    /** Areas this migration had to invent, written out for review. */
    private array $created = [];

    public function up(): void
    {
        $areaIds = $this->indexExistingAreas();
        $idMap = $this->mergeBroadAreaList($areaIds);

        $this->repointStudentPreferences($idMap);
        $this->absorbFreeTextAreas($areaIds);

        Schema::dropIfExists('broad_area_specializations');

        Schema::table('students', function (Blueprint $table) {
            $table->dropColumn('tentative_broad_area');
        });

        Schema::table('constitute_of_irb', function (Blueprint $table) {
            $table->dropColumn('broad_area_of_research');
        });

        $this->reportCreatedAreas();
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

        // Rebuild the old list from the merged one. Every area that belongs to a
        // department was a legitimate entry in both, so the reverse is a copy.
        $reverseMap = [];
        foreach (DB::table('area_of_specializations')->whereNotNull('department_id')->get() as $area) {
            $reverseMap[$area->id] = DB::table('broad_area_specializations')->insertGetId([
                'broad_area' => $area->name,
                'department_id' => $area->department_id,
                'created_at' => $area->created_at,
                'updated_at' => $area->updated_at,
            ]);
        }

        Schema::table('student_area_preferences', function (Blueprint $table) {
            $table->dropForeign(['specialization_id']);
        });

        Schema::rename('student_area_preferences', 'student_broad_area_specializations');

        // Rows pointing at an area with no department have nowhere to go back to.
        DB::table('student_broad_area_specializations')
            ->whereNotIn('specialization_id', array_keys($reverseMap) ?: [0])
            ->delete();

        $this->remapColumn('student_broad_area_specializations', $reverseMap);

        DB::statement('ALTER TABLE student_broad_area_specializations MODIFY specialization_id INT UNSIGNED NOT NULL');

        Schema::table('student_broad_area_specializations', function (Blueprint $table) {
            $table->foreign('specialization_id')
                ->references('id')->on('broad_area_specializations')->onDelete('cascade');
        });
    }

    /**
     * Every area already on the curated list, keyed by department and name.
     *
     * Kept by reference through the whole migration so an area invented while
     * absorbing free text is found by the next row that needs it, rather than
     * created twice.
     *
     * @return array<string, int>
     */
    private function indexExistingAreas(): array
    {
        $index = [];
        foreach (DB::table('area_of_specializations')->get() as $area) {
            $index[$this->key($area->department_id, $area->name)] = $area->id;
        }

        return $index;
    }

    /**
     * Fold the accidental list into the curated one.
     *
     * @param  array<string, int>  $areaIds
     * @return array<int, int> old broad area id => merged area id
     */
    private function mergeBroadAreaList(array &$areaIds): array
    {
        $idMap = [];

        foreach (DB::table('broad_area_specializations')->orderBy('id')->get() as $old) {
            $idMap[$old->id] = $this->findOrCreateArea($areaIds, $old->department_id, $old->broad_area);
        }

        return $idMap;
    }

    /**
     * Move the scholars' three preferences onto the merged list.
     *
     * @param  array<int, int>  $idMap
     */
    private function repointStudentPreferences(array $idMap): void
    {
        Schema::table('student_broad_area_specializations', function (Blueprint $table) {
            $table->dropForeign(['specialization_id']);
        });

        Schema::rename('student_broad_area_specializations', 'student_area_preferences');

        DB::statement('ALTER TABLE student_area_preferences MODIFY specialization_id BIGINT UNSIGNED NOT NULL');

        $this->remapColumn('student_area_preferences', $idMap);

        // Two near duplicate entries can merge into the same area, which would
        // leave a scholar holding the same preference twice.
        $duplicates = DB::table('student_area_preferences')
            ->selectRaw('MIN(id) as keep_id, student_id, specialization_id, COUNT(*) as total')
            ->groupBy('student_id', 'specialization_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicates as $duplicate) {
            DB::table('student_area_preferences')
                ->where('student_id', $duplicate->student_id)
                ->where('specialization_id', $duplicate->specialization_id)
                ->where('id', '!=', $duplicate->keep_id)
                ->delete();
        }

        Schema::table('student_area_preferences', function (Blueprint $table) {
            $table->foreign('specialization_id')
                ->references('id')->on('area_of_specializations')->onDelete('cascade');
        });
    }

    /**
     * Turn the two free text areas into a link on the merged list.
     *
     * The IRB value is applied second because it is the settled one: a scholar
     * writes a Domain on their profile before they know their area, and states
     * it properly when the IRB form is filled.
     *
     * @param  array<string, int>  $areaIds
     */
    private function absorbFreeTextAreas(array &$areaIds): void
    {
        $students = DB::table('students')
            ->select('roll_no', 'department_id', 'tentative_broad_area', 'area_of_specialization_id')
            ->get()
            ->keyBy('roll_no');

        foreach ($students as $student) {
            if ($student->area_of_specialization_id || !trim((string) $student->tentative_broad_area)) {
                continue;
            }

            $areaId = $this->findOrCreateArea($areaIds, $student->department_id, $student->tentative_broad_area);
            if ($areaId) {
                DB::table('students')->where('roll_no', $student->roll_no)
                    ->update(['area_of_specialization_id' => $areaId]);
            }
        }

        $irbForms = DB::table('constitute_of_irb')
            ->select('student_id', 'broad_area_of_research')
            ->whereNotNull('broad_area_of_research')
            ->orderBy('id')
            ->get();

        foreach ($irbForms as $form) {
            $value = trim((string) $form->broad_area_of_research);
            $student = $students[$form->student_id] ?? null;
            if ($value === '' || !$student) {
                continue;
            }

            // A numeric value is already an area id: the IRB form accepted both,
            // and the controller only stored the link when it was numeric.
            $areaId = ctype_digit($value)
                ? (DB::table('area_of_specializations')->where('id', $value)->value('id'))
                : $this->findOrCreateArea($areaIds, $student->department_id, $value);

            if ($areaId) {
                DB::table('students')->where('roll_no', $form->student_id)
                    ->update(['area_of_specialization_id' => $areaId]);
            }
        }
    }

    /**
     * @param  array<string, int>  $areaIds
     */
    private function findOrCreateArea(array &$areaIds, ?int $departmentId, ?string $name): ?int
    {
        $name = trim(preg_replace('/\s+/', ' ', (string) $name));
        if ($name === '' || !$departmentId) {
            return null;
        }

        $key = $this->key($departmentId, $name);
        if (isset($areaIds[$key])) {
            return $areaIds[$key];
        }

        $areaIds[$key] = DB::table('area_of_specializations')->insertGetId([
            'department_id' => $departmentId,
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->created[] = $departmentId . ': ' . $name;

        return $areaIds[$key];
    }

    /**
     * Names differ by case, spacing and punctuation far more often than they
     * differ in meaning, so all three are ignored when deciding whether two
     * rows are the same area.
     */
    private function key(?int $departmentId, ?string $name): string
    {
        $normalised = strtolower(trim(preg_replace('/[^a-z0-9]+/i', ' ', (string) $name)));

        return $departmentId . '|' . preg_replace('/\s+/', ' ', $normalised);
    }

    /**
     * Rewrite a column through a map in one statement.
     *
     * Row by row would corrupt the data: old and new ids share a number space,
     * so an early update can land on a value a later one still has to read.
     *
     * @param  array<int, int>  $map
     */
    private function remapColumn(string $table, array $map): void
    {
        if (!$map) {
            return;
        }

        $cases = '';
        foreach ($map as $from => $to) {
            $cases .= sprintf(' WHEN %d THEN %d', (int) $from, (int) $to);
        }

        DB::statement(sprintf(
            'UPDATE %s SET specialization_id = CASE specialization_id%s ELSE specialization_id END',
            $table,
            $cases
        ));
    }

    /**
     * Areas invented here were never reviewed by anyone, so they are worth
     * looking at and possibly deleting from the admin page.
     */
    private function reportCreatedAreas(): void
    {
        if (!$this->created) {
            return;
        }

        $path = storage_path('logs/area-merge.log');
        $body = now()->toDateTimeString() . " created " . count($this->created) . " areas from free text:\n"
            . implode("\n", $this->created) . "\n";

        file_put_contents($path, $body, FILE_APPEND);
    }
};
