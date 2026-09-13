<?php

namespace Tests\Feature;

use App\Models\ConstituteOfIRB;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * A form opened from a scholar's record.
 *
 * Every form has two paths: /forms/{type}/{form_id} for a role working their
 * own queue, and /students/{id}/forms/{type}/{form_id} for someone reading a
 * scholar's record. The controllers took the form id as their first argument,
 * which on the nested path is the scholar's roll number, so the second path
 * answered "No form found" for every role.
 */
class ScholarFormPageTest extends TestCase
{
    use DatabaseTransactions;

    private function actAs(User $user, string $role): void
    {
        $user->current_role_id = Role::where('role', $role)->value('id');
        $user->save();
        $this->actingAs($user->fresh());
    }

    private function form(): ConstituteOfIRB
    {
        $form = ConstituteOfIRB::query()->first();

        if (!$form) {
            $this->markTestSkipped('No IRB form in this database.');
        }

        return $form;
    }

    public function test_both_paths_load_the_same_form(): void
    {
        $form = $this->form();
        $this->actAs(User::where('email', 'admin@gmail.com')->firstOrFail(), 'admin');

        $nested = $this->getJson("/api/students/{$form->student_id}/forms/irb-constitution/{$form->id}");
        $flat = $this->getJson("/api/forms/irb-constitution/{$form->id}");

        $nested->assertOk();
        $flat->assertOk();
        $this->assertSame($form->id, $nested->json('form_id'));
        $this->assertSame($flat->json('form_id'), $nested->json('form_id'));
    }

    public function test_the_nested_path_still_refuses_a_role_without_the_scholar(): void
    {
        $form = $this->form();
        $student = Student::find($form->student_id);

        $stranger = Faculty::whereNotIn('faculty_code', $student->supervisors->pluck('faculty_code'))
            ->whereHas('user')
            ->first();

        if (!$stranger) {
            $this->markTestSkipped('No faculty outside this scholar’s supervisors.');
        }

        $this->actAs($stranger->user, 'faculty');

        $this->getJson("/api/students/{$form->student_id}/forms/irb-constitution/{$form->id}")
            ->assertStatus(403);
    }
}
