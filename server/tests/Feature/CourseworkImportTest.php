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

    public function test_a_scholar_cannot_import_coursework(): void
    {
        $this->actAs('student');
        $student = $this->scholar();

        $this->import([$this->row($student)])->assertStatus(403);
        $this->assertFalse(Course::where('course_code', 'ZZTEST101')->exists());
    }
}
