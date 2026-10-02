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

    /**
     * The list is a help, not a gate: the field stays free text. What it offers
     * is what this department's supervisors work on, plus what scholars here
     * have named before, so a word somebody had to type once is offered to the
     * next of them.
     */
    public function test_the_suggestions_offer_listed_areas_and_ones_scholars_named(): void
    {
        $student = $this->scholar();
        $supervisor = \App\Models\Faculty::where('department_id', $student->department_id)->firstOrFail();
        $supervisor->expertise = ['Zymology', 'Fermentation science'];
        $supervisor->save();

        AreaOfSpecialization::create([
            'department_id' => $student->department_id,
            'name' => 'A broad heading nobody works under',
        ]);

        StudentAreaPreference::create([
            'student_id' => $student->roll_no,
            'broad_area' => 'Underwater basket weaving',
        ]);

        $offered = collect($this->actingAs($student->user)
            ->postJson('/api/suggestions/specialization', ['text' => ''])
            ->assertStatus(200)
            ->json())
            ->pluck('name');

        $this->assertContains('Zymology', $offered, 'an area a supervisor lists should be offered');
        $this->assertContains('Underwater basket weaving', $offered, 'an area a scholar named should be offered next time');
        $this->assertNotContains(
            'A broad heading nobody works under',
            $offered,
            'the matrix heading is what a supervisor is filed under, not what anybody works on'
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

    /**
     * The broad area is one heading per department, so scoring it recommended
     * everybody in the department for anything asked inside it. What a scholar
     * picks from, and what is matched, is the specific areas supervisors list.
     */
    public function test_the_recommender_reads_the_specific_areas_not_the_broad_one(): void
    {
        $service = app(\App\Services\FacultyRecommendationService::class);

        $filed = \App\Models\Faculty::with('user')
            ->whereNotNull('department_id')->where('type', 'internal')->firstOrFail();
        $lists = \App\Models\Faculty::with('user')
            ->where('department_id', $filed->department_id)
            ->where('faculty_code', '!=', $filed->faculty_code)
            ->firstOrFail();

        $area = AreaOfSpecialization::create([
            'department_id' => $filed->department_id,
            'name' => 'Zymology',
        ]);

        $filed->area_of_specialization_id = $area->id;
        $filed->expertise = ['Something Unrelated'];
        $filed->save();

        $lists->area_of_specialization_id = null;
        $lists->expertise = ['Zymology'];
        $lists->save();

        $recommended = array_column($service->recommend(['Zymology'], $filed->department_id, 8), 'faculty_code');

        $this->assertContains(
            $lists->faculty_code,
            $recommended,
            'a supervisor who lists the area should be recommended for it'
        );
        $this->assertNotContains(
            $filed->faculty_code,
            $recommended,
            'being filed under a broad area of that name is not working on it'
        );
    }
}
