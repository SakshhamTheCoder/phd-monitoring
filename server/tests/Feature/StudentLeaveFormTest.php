<?php

namespace Tests\Feature;

use App\Models\Student;
use App\Models\StudentLeaveForm;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class StudentLeaveFormTest extends TestCase
{
    use DatabaseTransactions;

    private function actingAsStudent(): Student
    {
        $student = Student::query()->firstOrFail();
        $user = User::findOrFail($student->user_id);
        $this->actingAs($user, 'sanctum');

        return $student;
    }

    public function test_an_academic_application_without_a_document_is_rejected(): void
    {
        $student = $this->actingAsStudent();
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'academic',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-14',
            'day_part' => 'full',
            'reason' => 'Conference',
        ])->assertStatus(422);
    }

    public function test_a_casual_application_needs_no_document(): void
    {
        $student = $this->actingAsStudent();
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'casual',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-15',
            'day_part' => 'full',
            'reason' => 'Personal',
        ])->assertStatus(200);

        $this->assertSame('hod', $form->fresh()->stage);
    }

    public function test_a_multi_day_application_cannot_be_a_half_day(): void
    {
        $student = $this->actingAsStudent();
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'casual',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-16',
            'day_part' => 'first_half',
            'reason' => 'Personal',
        ])->assertStatus(422);
    }

    public function test_to_date_may_not_precede_from_date(): void
    {
        $student = $this->actingAsStudent();
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'casual',
            'from_date' => '2026-09-16',
            'to_date' => '2026-09-14',
            'day_part' => 'full',
            'reason' => 'Personal',
        ])->assertStatus(422);
    }

    public function test_an_over_quota_application_still_submits(): void
    {
        $student = $this->actingAsStudent();
        \App\Models\LeaveSetting::updateOrCreate(['key' => 'casual_quota'], ['value' => 1]);
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'casual',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-20',
            'day_part' => 'full',
            'reason' => 'Personal',
        ])->assertStatus(200);
    }

    public function test_a_student_can_create_a_leave_draft(): void
    {
        $student = $this->actingAsStudent();

        $this->postJson('/api/forms/student-leave')->assertStatus(200);

        $form = StudentLeaveForm::where('student_id', $student->roll_no)->latest('id')->first();
        $this->assertNotNull($form);
        $this->assertSame('draft', $form->status);
        $this->assertSame('student', $form->stage);
        $this->assertNotEmpty($form->steps);
    }

    public function test_a_second_draft_may_be_created_while_the_first_is_still_open(): void
    {
        $this->actingAsStudent();

        $this->postJson('/api/forms/student-leave')->assertStatus(200);
        $this->postJson('/api/forms/student-leave')->assertStatus(200);
    }

    public function test_a_non_student_cannot_create_a_leave_draft(): void
    {
        $user = User::whereHas('current_role', function ($query) {
            $query->where('role', '!=', 'student');
        })->firstOrFail();
        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/forms/student-leave')->assertStatus(403);
    }
}
