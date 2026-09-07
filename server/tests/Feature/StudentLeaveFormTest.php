<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Student;
use App\Models\StudentLeaveForm;
use App\Models\User;
use App\Support\LeaveBalance;
use App\Support\LeaveWindow;
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

    /** Switches the acting user to the HOD of $student's department. */
    private function actingAsHodFor(Student $student): void
    {
        $hodFaculty = Faculty::where('faculty_code', $student->department->hod_id)->firstOrFail();
        $hodUser = User::findOrFail($hodFaculty->user_id);
        $this->actingAs($hodUser, 'sanctum');
    }

    /** A leave already filled in and waiting at the HOD's desk. */
    private function leaveAwaitingHod(Student $student, array $attributes = []): StudentLeaveForm
    {
        return StudentLeaveForm::create(array_merge([
            'student_id' => $student->roll_no,
            'stage' => 'hod',
            'status' => 'pending',
            'leave_type' => 'casual',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-14',
            'day_part' => 'full',
            'reason' => 'Personal',
            'steps' => ['student', 'hod', 'complete'],
            // Mirrors what handleMoveToNextLevel sets when a student really
            // submits into the hod stage: locked from the student, open to hod.
            'student_lock' => true,
            'hod_lock' => false,
        ], $attributes));
    }

    public function test_an_academic_application_without_a_document_is_rejected(): void
    {
        $student = $this->actingAsStudent();
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        // Confirm this is rejected specifically for the missing document, not
        // because some other validation rule fired first.
        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'academic',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-14',
            'day_part' => 'full',
            'reason' => 'Conference',
        ])->assertStatus(422)
            ->assertJson(['message' => 'An academic leave needs a supporting document.']);
    }

    public function test_a_casual_application_with_a_document_is_rejected(): void
    {
        $student = $this->actingAsStudent();
        $form = StudentLeaveForm::create([
            'student_id' => $student->roll_no, 'stage' => 'student', 'status' => 'draft',
        ]);

        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'leave_type' => 'casual',
            'from_date' => '2026-09-14',
            'to_date' => '2026-09-14',
            'day_part' => 'full',
            'reason' => 'Personal',
            'supporting_document' => UploadedFile::fake()->create('proof.pdf', 100, 'application/pdf'),
        ])->assertStatus(422)
            ->assertJson(['message' => 'A casual leave takes no supporting document.']);
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
        $student = $this->actingAsStudent();

        $first = $this->postJson('/api/forms/student-leave')->assertStatus(200)->json('id');
        $second = $this->postJson('/api/forms/student-leave')->assertStatus(200)->json('id');

        $this->assertNotNull($first);
        $this->assertNotNull($second);
        $this->assertNotSame($first, $second);
        $this->assertSame(
            2,
            StudentLeaveForm::where('student_id', $student->roll_no)->count()
        );
    }

    public function test_a_non_student_cannot_create_a_leave_draft(): void
    {
        $user = User::whereHas('current_role', function ($query) {
            $query->where('role', '!=', 'student');
        })->firstOrFail();
        $this->actingAs($user, 'sanctum');

        $this->postJson('/api/forms/student-leave')->assertStatus(403);
    }

    public function test_hod_approval_marks_the_leave_approved(): void
    {
        $student = Student::query()->firstOrFail();
        $form = $this->leaveAwaitingHod($student);

        $this->actingAsHodFor($student);
        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'approval' => true,
        ])->assertStatus(200);

        $fresh = $form->fresh();
        $this->assertSame('approved', $fresh->status);
        $this->assertSame('complete', $fresh->completion);
    }

    /** The assertion that ties the whole feature together. */
    public function test_an_approved_leave_excuses_the_scholar(): void
    {
        $student = Student::query()->firstOrFail();
        $form = $this->leaveAwaitingHod($student, [
            'from_date' => '2026-09-15',
            'to_date' => '2026-09-15',
        ]);

        $this->actingAsHodFor($student);
        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'approval' => true,
        ])->assertStatus(200);

        $this->assertTrue(LeaveWindow::covers($form->fresh(), '2026-09-15'));
    }

    public function test_an_approved_leave_counts_against_the_quota(): void
    {
        $student = Student::query()->firstOrFail();
        $before = LeaveBalance::for((int) $student->roll_no, '2026-09-16')['casual']['used'];

        $form = $this->leaveAwaitingHod($student, [
            'from_date' => '2026-09-16',
            'to_date' => '2026-09-16',
        ]);

        $this->actingAsHodFor($student);
        $this->postJson("/api/forms/student-leave/{$form->id}", [
            'approval' => true,
        ])->assertStatus(200);

        $after = LeaveBalance::for((int) $student->roll_no, '2026-09-16')['casual']['used'];
        $this->assertSame($before + 1.0, $after);
    }
}
