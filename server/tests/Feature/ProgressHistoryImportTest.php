<?php

namespace Tests\Feature;

use App\Models\Presentation;
use App\Models\Role;
use App\Models\Semester;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The progress sheet: every past evaluation, one row per scholar per semester.
 *
 * The portal records a gain per period on top of a running total, while the
 * sheet states the total. Deriving the gain is the whole of the logic worth
 * pinning: it has to order a scholar's rows by semester code rather than by the
 * date the presentation happened to be held, and it has to leave anything the
 * portal is already running alone, so the same file can be loaded twice.
 */
class ProgressHistoryImportTest extends TestCase
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
        return $this->postJson('/api/presentation/import-progress', ['rows' => $rows]);
    }

    private function row(Student $student, string $semester, $total, int $rowNumber): array
    {
        return [
            'roll_no' => (string) $student->roll_no,
            'semester' => $semester,
            'date' => '2024-11-04',
            'total_progress' => (string) $total,
            'row_number' => $rowNumber,
        ];
    }

    /** A scholar with no presentations, so the sheet is the whole history. */
    private function freshScholar(): Student
    {
        $student = Student::whereNotIn('roll_no', Presentation::select('student_id'))->first()
            ?? Student::firstOrFail();

        Presentation::where('student_id', $student->roll_no)->delete();
        $student->overall_progress = 0;
        $student->save();

        return $student;
    }

    public function test_gains_are_derived_from_the_totals_in_semester_order(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        // Deliberately out of order in the file: the semester code decides.
        $this->import([
            $this->row($student, '2425ODD', 55, 4),
            $this->row($student, '2324ODD', 20, 2),
            $this->row($student, '2324EVEN', 35, 3),
        ])->assertStatus(200)->assertJsonPath('data.success_count', 3);

        $presentations = Presentation::where('student_id', $student->roll_no)
            ->join('semesters', 'semesters.id', '=', 'presentations.semester_id')
            ->orderBy('semesters.year')->orderBy('semesters.semester')
            ->select('presentations.*')
            ->get();

        $this->assertSame([0, 20, 35], $presentations->pluck('current_progress')->all());
        $this->assertSame([20, 15, 20], $presentations->pluck('progress')->all());
        $this->assertSame([20, 35, 55], $presentations->pluck('total_progress')->all());

        $this->assertSame(55.0, (float) $student->fresh()->overall_progress);
    }

    public function test_reloading_the_same_file_adds_nothing(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $rows = [$this->row($student, '2324ODD', 20, 2)];

        $this->import($rows)->assertStatus(200);
        $response = $this->import($rows)->assertStatus(200);

        $this->assertSame(0, $response->json('data.success_count'));
        $this->assertStringContainsString('already has a presentation', $response->json('data.errors.0'));
        $this->assertSame(1, Presentation::where('student_id', $student->roll_no)->count());
    }

    public function test_a_blank_total_is_skipped_and_a_falling_total_is_refused(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $response = $this->import([
            $this->row($student, '2324ODD', 40, 2),
            $this->row($student, '2324EVEN', 30, 3),
            $this->row($student, '2425ODD', '', 4),
        ])->assertStatus(200);

        $this->assertSame(1, $response->json('data.success_count'));
        $this->assertSame(1, $response->json('data.skipped_count'));
        $this->assertStringContainsString('lower than', $response->json('data.errors.0'));
        $this->assertSame(40.0, (float) $student->fresh()->overall_progress);
    }

    public function test_a_created_semester_carries_dates_so_it_is_not_hidden(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        Semester::where('semester_name', '2223ODD')->delete();

        $this->import([$this->row($student, '2223ODD', 10, 2)])->assertStatus(200);

        $semester = Semester::where('semester_name', '2223ODD')->firstOrFail();

        // The Past Semesters table filters on end_date < now, so a semester
        // created without one would never be listed.
        $this->assertNotNull($semester->end_date);
    }

    public function test_a_supervisor_cannot_import_progress(): void
    {
        $this->actAs('faculty');
        $student = Student::firstOrFail();

        $this->import([$this->row($student, '2324ODD', 20, 2)])->assertStatus(403);
    }
}
