<?php

namespace Tests\Feature;

use App\Models\Student;
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
}
