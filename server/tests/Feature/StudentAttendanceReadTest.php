<?php

namespace Tests\Feature;

use App\Models\Attendance;
use App\Models\Faculty;
use App\Models\Student;
use App\Models\StudentLeaveForm;
use App\Models\Supervisor;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class StudentAttendanceReadTest extends TestCase
{
    use DatabaseTransactions;

    public function test_a_scholar_reads_their_own_attendance_with_a_balance(): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAs(User::findOrFail($student->user_id), 'sanctum');

        $this->getJson("/api/clerks/attendance/student/{$student->roll_no}")
            ->assertStatus(200)
            ->assertJsonStructure([
                'student', 'summary', 'current_month', 'records',
                'balance' => ['academic', 'casual', 'window'],
                'leaves',
            ]);
    }

    public function test_a_scholar_cannot_read_another_scholars_attendance(): void
    {
        $student = Student::query()->firstOrFail();
        $other = Student::where('roll_no', '!=', $student->roll_no)->firstOrFail();
        $this->actingAs(User::findOrFail($student->user_id), 'sanctum');

        $this->getJson("/api/clerks/attendance/student/{$other->roll_no}")
            ->assertStatus(404);
    }

    /**
     * FIX 3: leave reasons are often medical or personal (spec 5.3 confines
     * `reason` to the HOD's review) — a supervising faculty member is one of
     * the seven roles admitted to this endpoint that must not see it.
     */
    public function test_a_supervising_faculty_does_not_receive_the_leave_reason(): void
    {
        $student = Student::query()->firstOrFail();
        $faculty = Faculty::where('faculty_code', '!=', $student->department->hod_id)
            ->whereNotNull('user_id')
            ->firstOrFail();
        Supervisor::firstOrCreate(['student_id' => $student->roll_no, 'faculty_id' => $faculty->faculty_code]);

        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'leave_type' => 'casual',
            'from_date' => '2026-09-10',
            'to_date' => '2026-09-10',
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
            'reason' => 'Medical procedure',
            'hod_comments' => 'Approved, get well soon',
        ]);

        $this->actingAs(User::findOrFail($faculty->user_id), 'sanctum');

        $response = $this->getJson("/api/clerks/attendance/student/{$student->roll_no}")
            ->assertStatus(200);

        $leave = collect($response->json('leaves'))->first();
        $this->assertNotNull($leave);
        $this->assertArrayNotHasKey('reason', $leave);
        $this->assertArrayNotHasKey('hod_comments', $leave);
        // Dates/type/status are still there — only the content is withheld.
        $this->assertSame('casual', $leave['leave_type']);
        $this->assertSame('approved', $leave['status']);
    }

    /**
     * FIX 5: nothing ever deletes an attendance row, so a clerk's absent mark
     * from before an HOD's approval can outlive it. The excused day must be
     * derived out of both `records` and `summary` (spec 1.1: not part of the
     * denominator) rather than the row being mutated or removed.
     */
    public function test_a_day_covered_by_an_approved_leave_is_excluded_from_records_and_summary(): void
    {
        $student = Student::query()->firstOrFail();

        Attendance::create([
            'roll_no' => $student->roll_no,
            'date' => '2026-09-05',
            'lecture_id' => 0,
            'status' => 'absent',
            'marked_by' => null,
        ]);
        Attendance::create([
            'roll_no' => $student->roll_no,
            'date' => '2026-09-06',
            'lecture_id' => 0,
            'status' => 'present',
            'marked_by' => null,
        ]);
        StudentLeaveForm::create([
            'student_id' => $student->roll_no,
            'leave_type' => 'casual',
            'from_date' => '2026-09-05',
            'to_date' => '2026-09-05',
            'day_part' => 'full',
            'status' => 'approved',
            'stage' => 'complete',
        ]);

        $this->actingAs(User::findOrFail($student->user_id), 'sanctum');

        $response = $this->getJson("/api/clerks/attendance/student/{$student->roll_no}?from=2026-09-01&to=2026-09-30")
            ->assertStatus(200);

        // The absent row on the excused day (2026-09-05) must be gone from
        // `records` entirely — leaving only the present row for 2026-09-06.
        // Not compared by string-slicing the returned date (it is a
        // date-cast column serialized under APP_TIMEZONE=Asia/Kolkata, so its
        // raw ISO string does not start with the calendar date it represents
        // — the same shift client-new/src/utils/leaveBalance.js's
        // localDateString exists to undo on the frontend); the record count
        // and status are enough to prove the excused day was dropped.
        $records = $response->json('records');
        $this->assertCount(1, $records);
        $this->assertSame('present', $records[0]['status']);

        $summary = $response->json('summary');
        $this->assertSame(1, $summary['total']);
        $this->assertSame(1, $summary['present']);
        $this->assertSame(0, $summary['absent']);
    }
}
