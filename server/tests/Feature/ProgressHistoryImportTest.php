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

    /**
     * Half the sheet's rows carry no date, or a word where one belongs, so the
     * evaluation lands without one. The office fills the dates in later and
     * sends the file again; that is the one thing worth taking from a row for
     * an evaluation that already exists.
     */
    public function test_a_later_file_fills_a_date_the_first_one_did_not_have(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $undated = $this->row($student, '2324ODD', 20, 2);
        $undated['date'] = '';
        $this->import([$undated])->assertStatus(200);

        $presentation = Presentation::where('student_id', $student->roll_no)->firstOrFail();
        $this->assertNull($presentation->date);

        $this->import([$this->row($student, '2324ODD', 20, 2)])->assertStatus(200);

        $this->assertSame('2024-11-04', substr((string) $presentation->fresh()->date, 0, 10));
        $this->assertSame(1, Presentation::where('student_id', $student->roll_no)->count());
    }

    /** A date already recorded is the portal's, and a re-import leaves it alone. */
    public function test_a_date_already_recorded_is_not_overwritten(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $this->import([$this->row($student, '2324ODD', 20, 2)])->assertStatus(200);

        $later = $this->row($student, '2324ODD', 20, 2);
        $later['date'] = '2025-01-01';
        $this->import([$later])->assertStatus(200);

        $this->assertSame(
            '2024-11-04',
            substr((string) Presentation::where('student_id', $student->roll_no)->firstOrFail()->date, 0, 10)
        );
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

    /**
     * The round trip the office actually wants: take away the rows that still
     * need something, fill the one empty column, send the same file back.
     */
    public function test_the_evaluations_missing_a_date_can_be_taken_away_as_a_file(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $undated = $this->row($student, '2324ODD', 20, 2);
        $undated['date'] = '';
        $this->import([$undated])->assertStatus(200);

        $answer = $this->getJson('/api/presentation/progress/missing-dates')->assertStatus(200);

        $this->assertSame(
            ['Registration Number', 'Student name', 'Progress for AY', 'Date of progress', 'Total Progress %'],
            $answer->json('headers'),
            'the file is in the shape the import reads'
        );

        $mine = collect($answer->json('rows'))->firstWhere(0, (string) $student->roll_no);
        $this->assertNotNull($mine);
        $this->assertSame('2324ODD', $mine[2]);
        $this->assertSame('', $mine[3], 'the date column is the empty one to fill');
    }

    public function test_a_supervisor_cannot_read_the_evaluations_missing_a_date(): void
    {
        $this->actAs('faculty');

        $this->getJson('/api/presentation/progress/missing-dates')->assertStatus(403);
    }

    public function test_a_supervisor_cannot_import_progress(): void
    {
        $this->actAs('faculty');
        $student = Student::firstOrFail();

        $this->import([$this->row($student, '2324ODD', 20, 2)])->assertStatus(403);
    }
    /**
     * The sheet writes one row per scholar who has finished: a total, and no
     * period, because it belongs to no semester. That is where the scholar
     * stands, so it is recorded against them and no evaluation is invented.
     * Those rows used to be dropped before the import saw them, so a scholar at
     * 100% imported as nothing at all.
     */
    public function test_a_total_with_no_period_is_the_scholars_standing_figure(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $response = $this->import([[
            'roll_no' => (string) $student->roll_no,
            'semester' => '',
            'date' => '',
            'total_progress' => '100',
            'row_number' => 2,
        ]])->assertStatus(200);

        $this->assertSame(100.0, (float) $student->fresh()->overall_progress);
        $this->assertSame(0, Presentation::where('student_id', $student->roll_no)->count());
        $this->assertStringContainsString(
            'standing total without naming an evaluation',
            json_encode($response->json('data.errors'))
        );
    }

    /** An evaluation still wins when the sheet gives both. */
    public function test_an_evaluation_and_a_standing_total_leave_the_higher_figure(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $this->import([
            $this->row($student, '2425ODD', 40, 2),
            [
                'roll_no' => (string) $student->roll_no,
                'semester' => '',
                'date' => '',
                'total_progress' => '100',
                'row_number' => 3,
            ],
        ])->assertStatus(200);

        $this->assertSame(100.0, (float) $student->fresh()->overall_progress);
        $this->assertSame(1, Presentation::where('student_id', $student->roll_no)->count());
    }
    /**
     * The sheet states all three figures, and on 43 rows of the institute's own
     * file the total column is empty while the two either side of it are
     * filled. Adding them is what a person reading the row does, and it is the
     * difference between the evaluation being recorded and being skipped.
     */
    public function test_the_total_is_added_up_when_the_row_does_not_state_it(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $this->postJson('/api/presentation/import-progress', ['rows' => [[
            '_rowNumber' => 2,
            'Registration Number' => (string) $student->roll_no,
            'Progress for AY' => 'July-Dec 2024',
            'Date of progress' => '04-11-2024',
            'Previous Progress %' => '20',
            'Progress for this period' => '15',
            'Total Progress %' => '',
        ]]])->assertStatus(200)->assertJsonPath('data.success_count', 1);

        $this->assertSame(35.0, (float) Presentation::where('student_id', $student->roll_no)->value('total_progress'));
    }

    /** With only one of the two, there is nothing to add, so the row is skipped. */
    public function test_one_figure_alone_is_not_a_total(): void
    {
        $this->actAs('admin');
        $student = $this->freshScholar();

        $this->postJson('/api/presentation/import-progress', ['rows' => [[
            '_rowNumber' => 2,
            'Registration Number' => (string) $student->roll_no,
            'Progress for AY' => 'July-Dec 2024',
            'Date of progress' => '04-11-2024',
            'Previous Progress %' => '',
            'Progress for this period' => '15',
            'Total Progress %' => '',
        ]]])->assertStatus(200)->assertJsonPath('data.success_count', 0);

        $this->assertSame(0, Presentation::where('student_id', $student->roll_no)->count());
    }
}
