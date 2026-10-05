<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * The qualification a scholar was admitted on, which the office records when
 * the record is created and which two coursework rules read.
 */
class ScholarQualificationTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        return $user->fresh();
    }

    public function test_the_office_records_it_when_the_scholar_is_added(): void
    {
        Notification::fake();
        $stamp = uniqid();
        $rollNumber = '9' . substr((string) time(), -6);

        $this->actingAs($this->admin())->postJson('/api/students/add', [
            'full_name' => 'Executive Scholar',
            'email' => "executive.{$stamp}@fixture.test",
            'phone' => '7' . substr((string) time(), -9),
            'roll_no' => $rollNumber,
            'department_id' => Department::firstOrFail()->id,
            'date_of_registration' => '2026-08-01',
            'current_status' => 'executive',
            'gender' => 'Female',
            'highest_qualification' => 'bachelors',
            'qualification_institute' => 'Punjab Engineering College',
            'qualification_percentage' => '68.50',
        ])->assertSuccessful();

        $student = Student::where('roll_no', $rollNumber)->firstOrFail();
        $this->assertSame('bachelors', $student->highest_qualification);
        $this->assertSame('Punjab Engineering College', $student->qualification_institute);
        $this->assertSame('68.50', (string) $student->qualification_percentage);

        // Admitted on a four year degree in the 60 to 75 band, so the
        // accelerated masters programme is owed on top of the UGC figure.
        $this->assertSame(48, $student->requiredCredits());
    }

    public function test_a_percentage_outside_the_scale_is_refused(): void
    {
        Notification::fake();

        $this->actingAs($this->admin())->postJson('/api/students/add', [
            'full_name' => 'Impossible Scholar',
            'email' => 'impossible.' . uniqid() . '@fixture.test',
            'phone' => '7' . substr((string) time(), -9),
            'roll_no' => '8' . substr((string) time(), -6),
            'department_id' => Department::firstOrFail()->id,
            'date_of_registration' => '2026-08-01',
            'current_status' => 'full-time',
            'gender' => 'Male',
            'qualification_percentage' => '140',
        ])->assertStatus(422);
    }

    public function test_the_blanks_are_allowed_and_change_nothing(): void
    {
        Notification::fake();
        $rollNumber = '7' . substr((string) time(), -6);

        $this->actingAs($this->admin())->postJson('/api/students/add', [
            'full_name' => 'Unrecorded Scholar',
            'email' => 'unrecorded.' . uniqid() . '@fixture.test',
            'phone' => '7' . substr((string) time(), -9),
            'roll_no' => $rollNumber,
            'department_id' => Department::firstOrFail()->id,
            'date_of_registration' => '2026-08-01',
            'current_status' => 'executive',
            'gender' => 'Male',
        ])->assertSuccessful();

        $student = Student::where('roll_no', $rollNumber)->firstOrFail();
        $this->assertNull($student->highest_qualification);
        // The UGC figure alone: nobody has said what they were admitted on.
        $this->assertSame(12, $student->requiredCredits());
        $this->assertSame(0, $student->requiredMastersCourses());
    }
}
