<?php

namespace Tests\Feature;

use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\Supervisor;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The scholars sheet, and the two ways importing it used to destroy data.
 *
 * A spreadsheet carries every column on every row, so a row meant to correct one
 * phone number arrives with a dozen empty cells. Those used to be written, which
 * emptied the PhD title, address, CGPA and IRB date and set the approved overall
 * progress to zero. And because the roll number and the email were looked up
 * separately and never compared, a row pairing one scholar's email with
 * another's roll number wrote half of itself onto each.
 *
 * The sheet also states who supervises whom, which is why filled cells replace
 * the whole set rather than adding to it.
 */
class StudentSheetImportTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    /** A row as StudentsPage sends it: every column present, most of them blank. */
    private function row(Student $student, array $overrides = []): array
    {
        return array_merge([
            'full_name' => '',
            'email' => $student->user->email,
            'phone' => '',
            'roll_no' => (string) $student->roll_no,
            'department_code' => '',
            'gender' => '',
            'date_of_registration' => '',
            'date_of_irb' => '',
            'date_of_synopsis' => '',
            'date_of_thesis' => '',
            'phd_title' => '',
            'fathers_name' => '',
            'address' => '',
            'current_status' => '',
            'cgpa' => '',
            'overall_progress' => '',
            'supervisors' => [],
            'committee' => [],
        ], $overrides);
    }

    private function import(array $row)
    {
        return $this->postJson('/api/students/bulk-upload', ['students' => [$row]]);
    }

    private function scholar(): Student
    {
        return Student::with('user')->whereNotNull('department_id')->firstOrFail();
    }

    public function test_blank_cells_leave_stored_values_alone(): void
    {
        $this->admin();

        $student = $this->scholar();
        $student->phd_title = 'A title worth keeping';
        $student->address = 'Patiala';
        $student->cgpa = 8.4;
        $student->overall_progress = 60;
        $student->save();

        $this->import($this->row($student, ['phone' => '9800000000']))
            ->assertStatus(200)
            ->assertJsonPath('data.update_count', 1);

        $student = $student->fresh();

        $this->assertSame('A title worth keeping', $student->phd_title);
        $this->assertSame('Patiala', $student->address);
        $this->assertSame(8.4, (float) $student->cgpa);
        $this->assertSame(60.0, (float) $student->overall_progress);
        $this->assertSame('9800000000', $student->user->fresh()->phone);
    }

    public function test_a_row_pairing_two_different_scholars_is_refused(): void
    {
        $this->admin();

        $scholars = Student::with('user')->take(2)->get();
        $this->assertCount(2, $scholars, 'needs two scholars');

        $originalTitle = $scholars[1]->phd_title;

        $response = $this->import($this->row($scholars[1], [
            'email' => $scholars[0]->user->email,
            'phd_title' => 'Written onto the wrong scholar',
        ]))->assertStatus(200);

        $this->assertStringContainsString('belong to different scholars', $response->json('data.errors.0'));
        $this->assertSame($originalTitle, $scholars[1]->fresh()->phd_title);
        $this->assertNotSame('Written onto the wrong scholar', $scholars[0]->fresh()->phd_title);
    }

    public function test_the_sheet_replaces_the_supervisors_and_the_committee(): void
    {
        $this->admin();

        $student = $this->scholar();
        $faculty = Faculty::with('user')->where('type', 'internal')->take(2)->get();
        $this->assertCount(2, $faculty, 'needs two faculty');

        Supervisor::where('student_id', $student->roll_no)->delete();
        Supervisor::create(['student_id' => $student->roll_no, 'faculty_id' => $faculty[0]->faculty_code]);
        DoctoralCommittee::where('student_id', $student->roll_no)->delete();

        $this->import($this->row($student, [
            'supervisors' => [$faculty[1]->user->email],
            'committee' => [$faculty[0]->user->email],
        ]))->assertStatus(200);

        $this->assertSame(
            [$faculty[1]->faculty_code],
            Supervisor::where('student_id', $student->roll_no)->pluck('faculty_id')->all()
        );
        $this->assertSame(
            [$faculty[0]->faculty_code],
            DoctoralCommittee::where('student_id', $student->roll_no)->pluck('faculty_id')->all()
        );
    }

    public function test_blank_supervisor_cells_leave_the_team_alone(): void
    {
        $this->admin();

        $student = $this->scholar();
        $faculty = Faculty::where('type', 'internal')->firstOrFail();

        Supervisor::where('student_id', $student->roll_no)->delete();
        Supervisor::create(['student_id' => $student->roll_no, 'faculty_id' => $faculty->faculty_code]);

        $this->import($this->row($student))->assertStatus(200);

        $this->assertSame(
            [$faculty->faculty_code],
            Supervisor::where('student_id', $student->roll_no)->pluck('faculty_id')->all()
        );
    }
}
