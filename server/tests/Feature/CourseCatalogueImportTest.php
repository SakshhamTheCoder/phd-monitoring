<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The course catalogue: one row per subject, not per scholar.
 *
 * The coursework import meets a subject on a scholar's row and creates it from
 * what that row knows, which is a name, sometimes no credits, and never a
 * department, since a scholar's row does not say who teaches the subject. This
 * import is where those are filled in, and it reads a corrected file back onto
 * the same subject rather than adding a second one under the same code.
 */
class CourseCatalogueImportTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        return tap($user->fresh(), fn ($fresh) => $this->actingAs($fresh, 'sanctum'));
    }

    private function import(array $rows)
    {
        return $this->postJson('/api/courses/import', ['rows' => $rows]);
    }

    private function row(array $overrides = []): array
    {
        return array_merge([
            'Course Code' => 'ZZCAT101',
            'Course Name' => 'Catalogue Test Subject',
            'Credits' => '3',
            'Department Code' => Department::whereNotNull('code')->value('code'),
            '_rowNumber' => 2,
        ], $overrides);
    }

    public function test_a_subject_is_created_with_its_department(): void
    {
        $this->admin();
        Course::where('course_code', 'ZZCAT101')->delete();
        $code = Department::whereNotNull('code')->value('code');

        $this->import([$this->row()])->assertStatus(200)->assertJsonPath('data.errors', []);

        $course = Course::where('course_code', 'ZZCAT101')->firstOrFail();
        $this->assertSame('Catalogue Test Subject', $course->course_name);
        $this->assertSame(3.0, (float) $course->credits);
        $this->assertSame(
            Department::whereRaw('UPPER(code) = ?', [strtoupper($code)])->value('id'),
            $course->department_id
        );
    }

    /** The whole point: a corrected file fixes the subject rather than duplicating it. */
    public function test_the_same_code_again_updates_rather_than_duplicating(): void
    {
        $this->admin();
        Course::where('course_code', 'ZZCAT102')->delete();

        $this->import([$this->row(['Course Code' => 'ZZCAT102', 'Credits' => ''])])->assertStatus(200);
        $this->import([$this->row(['Course Code' => 'ZZCAT102', 'Credits' => '4'])])->assertStatus(200);

        $this->assertSame(1, Course::where('course_code', 'ZZCAT102')->count());
        $this->assertSame(4.0, (float) Course::where('course_code', 'ZZCAT102')->value('credits'));
    }

    /** A blank cell says nothing, so a file may carry only the column being fixed. */
    public function test_a_blank_cell_leaves_what_is_stored_alone(): void
    {
        $this->admin();
        Course::where('course_code', 'ZZCAT103')->delete();

        $this->import([$this->row(['Course Code' => 'ZZCAT103'])])->assertStatus(200);
        $this->import([['Course Code' => 'ZZCAT103', 'Credits' => '2', '_rowNumber' => 2]])->assertStatus(200);

        $course = Course::where('course_code', 'ZZCAT103')->firstOrFail();
        $this->assertSame('Catalogue Test Subject', $course->course_name, 'the name it already had');
        $this->assertSame(2.0, (float) $course->credits);
        $this->assertNotNull($course->department_id, 'the department it already had');
    }

    public function test_a_department_code_nobody_has_is_reported(): void
    {
        $this->admin();

        $answer = $this->import([$this->row(['Course Code' => 'ZZCAT104', 'Department Code' => 'NOSUCH'])])
            ->assertStatus(200);

        $this->assertStringContainsString("no department with the code 'NOSUCH'", json_encode($answer->json('data.errors')));
        $this->assertNull(Course::where('course_code', 'ZZCAT104')->first());
    }

    public function test_the_import_offers_the_subjects_still_missing_details(): void
    {
        $this->admin();
        Course::where('course_code', 'ZZCAT105')->delete();
        Course::create(['course_code' => 'ZZCAT105', 'course_name' => 'Worth Nothing Yet', 'credits' => 0]);

        $answer = $this->getJson('/api/courses/missing-details')->assertStatus(200);

        $this->assertSame(['Course Code', 'Course Name', 'Credits', 'Department Code'], $answer->json('headers'));

        $row = collect($answer->json('rows'))->firstWhere(0, 'ZZCAT105');
        $this->assertNotNull($row);
        $this->assertSame(['', ''], [$row[2], $row[3]], 'the credits and department columns are the empty ones');
    }

    public function test_a_scholar_cannot_import_the_catalogue(): void
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'student')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        $this->import([$this->row()])->assertStatus(403);
        $this->getJson('/api/courses/missing-details')->assertStatus(403);
    }
}
