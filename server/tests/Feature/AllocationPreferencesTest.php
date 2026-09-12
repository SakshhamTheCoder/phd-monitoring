<?php

namespace Tests\Feature;

use App\Models\AreaOfSpecialization;
use App\Models\Student;
use App\Models\StudentAreaPreference;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The areas a scholar names on the supervisor allocation form.
 *
 * These are free text, and that is the point: the scholar is describing what
 * they hope to work on before a supervisor exists, so the form cannot restrict
 * them to a list. Production makes the case plainly - MED has 26 scholars
 * waiting at this step and three areas on record, so a dropdown would have left
 * them choosing between three options or nothing.
 *
 * The cost of the old free text was never the typing. It was that the words
 * were stored as rows in a table that doubled as every department's official
 * area list, so one scholar's spelling became a suggestion shown to everyone
 * else. Keeping the words against the scholar removes that without taking the
 * freedom away.
 */
class AllocationPreferencesTest extends TestCase
{
    use DatabaseTransactions;

    private function scholar(): Student
    {
        return Student::with('user')->whereNotNull('department_id')->firstOrFail();
    }

    public function test_a_preference_is_the_scholars_own_words(): void
    {
        $student = $this->scholar();
        StudentAreaPreference::where('student_id', $student->roll_no)->delete();

        StudentAreaPreference::create([
            'student_id' => $student->roll_no,
            'broad_area' => 'Something nobody has offered before',
        ]);

        $this->assertSame(
            ['Something nobody has offered before'],
            $student->fresh()->areaPreferences->pluck('broad_area')->all()
        );
    }

    public function test_naming_an_area_does_not_add_it_to_the_department_list(): void
    {
        $student = $this->scholar();
        $before = AreaOfSpecialization::where('department_id', $student->department_id)->count();

        StudentAreaPreference::create([
            'student_id' => $student->roll_no,
            'broad_area' => 'Underwater Basket Weaving',
        ]);

        $this->assertSame(
            $before,
            AreaOfSpecialization::where('department_id', $student->department_id)->count(),
            'a scholar naming an area must not change what the department offers'
        );
    }

    public function test_the_recommender_reads_a_supervisors_broad_area_as_well_as_their_expertise(): void
    {
        $faculty = \App\Models\Faculty::with('user')
            ->whereNotNull('department_id')->where('type', 'internal')->firstOrFail();

        $area = AreaOfSpecialization::create([
            'department_id' => $faculty->department_id,
            'name' => 'Zymology',
        ]);

        $faculty->area_of_specialization_id = $area->id;
        $faculty->expertise = ['Something Unrelated'];
        $faculty->save();

        $recommended = app(\App\Services\FacultyRecommendationService::class)
            ->recommend(['Zymology'], $faculty->department_id, 8);

        $this->assertContains(
            $faculty->faculty_code,
            array_column($recommended, 'faculty_code'),
            'a supervisor whose broad area matches should be recommended for it'
        );
    }
}
