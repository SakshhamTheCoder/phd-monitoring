<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Student;
use App\Models\StudentLeaveForm;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class ClerkLeaveTest extends TestCase
{
    use DatabaseTransactions;

    // save() rejects any date after "today"; keep this on or before the
    // machine's current date so the save() test doesn't fail validation
    // before ever reaching the leave-skip logic under test.
    private const DATE = '2026-09-01';

    private function studentOnLeave(): Student
    {
        $student = Student::query()->firstOrFail();
        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'leave_type' => 'casual',
            'from_date' => self::DATE,
            'to_date' => self::DATE,
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
        ]);

        return $student;
    }

    private function actingAsAdmin(): void
    {
        $admin = User::whereHas('role', fn ($q) => $q->where('role', 'admin'))->firstOrFail();
        $this->actingAs($admin, 'sanctum');
    }

    public function test_the_roster_reports_a_scholar_on_leave(): void
    {
        $student = $this->studentOnLeave();
        $this->actingAsAdmin();

        $response = $this->getJson('/api/clerks/attendance?date=' . self::DATE)->assertStatus(200);

        $row = collect($response->json('students'))->firstWhere('roll_no', $student->roll_no);
        $this->assertTrue($row['on_leave']);
        $this->assertSame('casual', $row['leave_type']);
    }

    public function test_a_scholar_not_on_leave_is_not_flagged(): void
    {
        $student = $this->studentOnLeave();
        $this->actingAsAdmin();

        $response = $this->getJson('/api/clerks/attendance?date=2026-09-20')->assertStatus(200);

        $row = collect($response->json('students'))->firstWhere('roll_no', $student->roll_no);
        $this->assertArrayHasKey('on_leave', $row);
        $this->assertFalse($row['on_leave']);
        $this->assertNull($row['leave_type']);
        $this->assertNull($row['day_part']);
    }

    public function test_saving_writes_no_row_for_a_scholar_on_leave(): void
    {
        $student = $this->studentOnLeave();
        $this->actingAsAdmin();

        $response = $this->postJson('/api/clerks/attendance', [
            'date' => self::DATE,
            'records' => [['roll_no' => $student->roll_no, 'status' => 'absent']],
        ])->assertStatus(200);

        $this->assertSame(1, $response->json('skipped_on_leave'));
        $this->assertNull(Attendance::where('roll_no', $student->roll_no)
            ->where('date', self::DATE)->first());
    }

    /** FIX 6: spec 4.6 scopes the leave-quota read to admin, clerk, hod, student. */
    public function test_leave_settings_are_readable_by_an_allowed_role(): void
    {
        $this->actingAsAdmin();

        $this->getJson('/api/clerks/leave-settings')->assertStatus(200);
    }

    public function test_leave_settings_are_not_readable_by_a_role_outside_the_gate(): void
    {
        $director = User::whereHas('role', fn ($q) => $q->where('role', 'director'))->firstOrFail();
        $this->actingAs($director, 'sanctum');

        $this->getJson('/api/clerks/leave-settings')->assertStatus(403);
    }
}
