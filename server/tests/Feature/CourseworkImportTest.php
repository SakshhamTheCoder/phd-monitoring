<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Role;
use App\Models\Student;
use App\Models\StudentCourse;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The coursework sheet.
 *
 * This import could not have worked: it wrote `$student->id`, and students are
 * keyed by roll_no with no id column at all, so the foreign key rejected every
 * new row. The same mistake made a scholar's own course list always empty. It
 * also had no permission check of any kind, and read its columns by position.
 *
 * The sheet is where the courses themselves come from, so a subject code the
 * portal has never seen is created from the row rather than refused.
 */
class CourseworkImportTest extends TestCase
{
    use DatabaseTransactions;

    private function actAs(string $role): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    private function import(array $rows)
    {
        return $this->postJson('/api/courses/student/bulk-import', ['rows' => $rows]);
    }

    private function row(Student $student, array $overrides = []): array
    {
        return array_merge([
            'Registration Number' => (string) $student->roll_no,
            'Academic Year' => '2425ODD',
            'Subject Code' => 'ZZTEST101',
            'Subject' => 'Test Subject',
            'Credits' => '3',
            'Grade' => 'A',
            'row_number' => 2,
        ], $overrides);
    }

    private function scholar(): Student
    {
        return Student::with('user')->firstOrFail();
    }

    public function test_a_new_subject_is_created_and_the_enrolment_reaches_the_scholar(): void
    {
        $this->actAs('admin');
        $student = $this->scholar();

        $this->import([$this->row($student)])
            ->assertStatus(200)
            ->assertJsonPath('data.success_count', 1)
            ->assertJsonPath('data.errors', []);

        $course = Course::where('course_code', 'ZZTEST101')->firstOrFail();
        $enrolment = StudentCourse::where('student_id', $student->roll_no)
            ->where('course_id', $course->id)->firstOrFail();

        $this->assertSame('completed', $enrolment->status);
        $this->assertSame('A', $enrolment->grade);
        $this->assertSame('2425ODD', $enrolment->semester);
    }

    public function test_a_blank_grade_means_still_enrolled_and_a_rerun_does_not_duplicate(): void
    {
        $this->actAs('admin');
        $student = $this->scholar();

        $this->import([$this->row($student, ['Grade' => ''])])->assertStatus(200);
        $this->import([$this->row($student, ['Grade' => ''])])->assertStatus(200);

        $course = Course::where('course_code', 'ZZTEST101')->firstOrFail();
        $enrolments = StudentCourse::where('student_id', $student->roll_no)
            ->where('course_id', $course->id)->get();

        $this->assertCount(1, $enrolments);
        $this->assertSame('enrolled', $enrolments[0]->status);
        $this->assertNull($enrolments[0]->grade);
    }

    public function test_the_sheets_bracketed_header_hints_are_ignored(): void
    {
        $this->actAs('admin');
        $student = $this->scholar();

        // The institute's own headers, hints and all.
        $this->import([[
            'Registration Number' => (string) $student->roll_no,
            'Academic Year (In which Student Studied the Subject)' => '2425ODD',
            'Subjectcode' => 'ZZTEST101',
            'Subject' => 'Research Methodology',
            'Credits' => '4',
            'Grade Earned (Leave Blank If Enrolled But Not Cleared Yet)' => 'A',
            'row_number' => 2,
        ]])->assertStatus(200)->assertJsonPath('data.success_count', 1);

        $course = Course::where('course_code', 'ZZTEST101')->firstOrFail();
        $enrolment = StudentCourse::where('student_id', $student->roll_no)
            ->where('course_id', $course->id)->firstOrFail();

        $this->assertSame('2425ODD', $enrolment->semester);
        $this->assertSame('A', $enrolment->grade);
    }

    public function test_columns_are_read_by_name_not_position(): void
    {
        $this->actAs('admin');
        $student = $this->scholar();

        // Same values, reversed key order, plus a column the portal ignores.
        $row = array_reverse($this->row($student, ['Email' => 'ignored@thapar.edu']), true);

        $this->import([$row])->assertStatus(200)->assertJsonPath('data.success_count', 1);

        $course = Course::where('course_code', 'ZZTEST101')->firstOrFail();
        $this->assertTrue(
            StudentCourse::where('student_id', $student->roll_no)->where('course_id', $course->id)->exists()
        );
    }

    /**
     * A subject the sheet introduces without credits is worth nothing towards
     * the scholar's requirement, so the row says so, and the same download,
     * fill, upload round trip the other imports have fills it in.
     */
    public function test_a_subject_with_no_credits_is_reported_and_can_be_filled_later(): void
    {
        $this->actAs('admin');
        $scholar = $this->scholar();

        Course::where('course_code', 'ZZCRED101')->delete();

        $answer = $this->import([$this->row($scholar, ['Subject Code' => 'ZZCRED101', 'Credits' => ''])])
            ->assertStatus(200);

        $this->assertStringContainsString(
            "'ZZCRED101' is new and the row gives no credits",
            json_encode($answer->json('data.errors'))
        );
        $this->assertSame(0.0, (float) Course::where('course_code', 'ZZCRED101')->value('credits'));

        // The file comes back with the credits filled in.
        $answer = $this->import([$this->row($scholar, ['Subject Code' => 'ZZCRED101', 'Credits' => '4'])])
            ->assertStatus(200);

        $this->assertSame(4.0, (float) Course::where('course_code', 'ZZCRED101')->value('credits'));
        $this->assertStringContainsString("had no credits, now worth 4", json_encode($answer->json('data.errors')));
    }

    /** The rows whose subject is worth nothing, in the shape this import reads. */
    public function test_the_import_offers_the_rows_whose_subject_has_no_credits(): void
    {
        $this->actAs('admin');
        $scholar = $this->scholar();

        Course::where('course_code', 'ZZCRED202')->delete();
        $this->import([$this->row($scholar, ['Subject Code' => 'ZZCRED202', 'Credits' => ''])])->assertStatus(200);

        $answer = $this->getJson('/api/courses/student/without-credits')->assertStatus(200);

        $this->assertSame(
            ['Registration Number', 'Full Name', 'Academic Year', 'Subject Code', 'Subject Name',
             'Credits', 'Grade Earned (Leave Blank If Enrolled But Not Cleared Yet)'],
            $answer->json('headers')
        );

        $row = collect($answer->json('rows'))->firstWhere(3, 'ZZCRED202');
        $this->assertNotNull($row);
        $this->assertSame('', $row[5], 'the credits column is the empty one to fill');
    }

    public function test_a_scholar_cannot_import_coursework(): void
    {
        $this->actAs('student');
        $student = $this->scholar();

        $this->import([$this->row($student)])->assertStatus(403);
        $this->assertFalse(Course::where('course_code', 'ZZTEST101')->exists());
    }
    /**
     * The institute's own sheet carries both the academic year (2425) and the
     * semester within it, written 2425EVESEM or 2122ODDSEM. The portal stores
     * the semester, in the shape the progress import and the forms use, so a
     * scholar's coursework and their evaluations name the same period.
     */
    public function test_the_sheets_semester_token_is_stored_as_the_portals_code(): void
    {
        $this->actAs('admin');
        $student = $this->scholar();

        $this->import([$this->row($student, [
            'Academic Year' => '2425',
            'Semester' => '2425EVESEM',
        ])])->assertStatus(200)->assertJsonPath('data.success_count', 1);

        $course = Course::where('course_code', 'ZZTEST101')->firstOrFail();
        $this->assertSame(
            '2425EVEN',
            StudentCourse::where('student_id', $student->roll_no)->where('course_id', $course->id)->value('semester')
        );
    }

    /** A sheet that names only the academic year still tags by that year. */
    public function test_a_sheet_with_only_the_academic_year_still_tags(): void
    {
        $this->actAs('admin');
        $student = $this->scholar();

        $this->import([$this->row($student, ['Academic Year' => '809'])])
            ->assertStatus(200)
            ->assertJsonPath('data.success_count', 1);

        $course = Course::where('course_code', 'ZZTEST101')->firstOrFail();
        $this->assertSame(
            '809',
            StudentCourse::where('student_id', $student->roll_no)->where('course_id', $course->id)->value('semester')
        );
    }
}
