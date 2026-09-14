<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * adordc is the one role with can_manage_students that lacks can_read_all_students
 * (StudentController::writableDepartmentIds), so before this fix an adordc
 * could provision any scholar in the institute through adminUpdate, not just
 * the departments they administer, the same gap list()/get() had already
 * closed on the read side.
 *
 * departments.adordc_id has no unique constraint, so pointing it at a faculty
 * code for the duration of one transaction is a cheap, realistic fixture: it
 * is exactly how the column is meant to be set, just done directly instead of
 * through the officer CSV import.
 */
class AdordcStudentUpdateScopeTest extends TestCase
{
    use DatabaseTransactions;

    private function twoDepartmentsWithStudents(): array
    {
        $ids = Student::query()
            ->whereNotNull('department_id')
            ->whereNotNull('user_id')
            ->select('department_id')
            ->distinct()
            ->pluck('department_id')
            ->take(2);

        if ($ids->count() < 2) {
            $this->markTestSkipped('needs students with user accounts in at least two departments');
        }

        return [Department::findOrFail($ids[0]), Department::findOrFail($ids[1])];
    }

    private function adordcFor(Department $department, Department $notFor): User
    {
        $faculty = Faculty::whereNotNull('user_id')->firstOrFail();

        $department->adordc_id = $faculty->faculty_code;
        $department->save();
        // Belt and braces: make sure the faculty picked is not also the
        // outsider department's adordc by coincidence of seed data.
        if ($notFor->adordc_id === $faculty->faculty_code) {
            $notFor->adordc_id = null;
            $notFor->save();
        }

        $user = User::findOrFail($faculty->user_id);
        $user->current_role_id = Role::where('role', 'adordc')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        return $user->fresh();
    }

    private function validUpdateBody(Student $student, Department $department): array
    {
        $user = $student->user;

        return [
            'first_name' => $user->first_name ?: 'Scope',
            'last_name' => $user->last_name ?: 'Test',
            'phone' => $user->phone ?: '9800000099',
            'email' => $user->email,
            'department_id' => $department->id,
            'date_of_registration' => optional($student->date_of_registration)->format('Y-m-d') ?? now()->toDateString(),
            'current_status' => $student->current_status ?: 'full-time',
            'gender' => $user->gender ?: 'Male',
        ];
    }

    public function test_an_adordc_cannot_update_a_student_outside_their_departments(): void
    {
        [$own, $other] = $this->twoDepartmentsWithStudents();
        $this->adordcFor($own, $other);

        $outsider = Student::where('department_id', $other->id)->whereNotNull('user_id')->firstOrFail();

        $this->postJson("/api/students/{$outsider->roll_no}/update", $this->validUpdateBody($outsider, $other))
            ->assertStatus(403);
    }

    public function test_an_adordc_may_update_a_student_in_their_own_department(): void
    {
        [$own, $other] = $this->twoDepartmentsWithStudents();
        $this->adordcFor($own, $other);

        $target = Student::where('department_id', $own->id)->whereNotNull('user_id')->firstOrFail();

        $this->postJson("/api/students/{$target->roll_no}/update", $this->validUpdateBody($target, $own))
            ->assertStatus(200);
    }
}
