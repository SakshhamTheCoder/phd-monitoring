<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * D15: a scholar's form list is built by a per-role switch (GeneralFormList
 * and UserController::listForms both have one), and neither had a case for
 * clerk or any other unmapped role, so before the fix the switch fell through
 * to no branch at all rather than a default refusal. This exercises three
 * different code paths behind /students/{roll_no}/forms/{type} to prove the
 * default-deny holds across the ones that route through GeneralFormList's
 * listForms (presentation), listFormsStudent (irb-constitution), and the one
 * that isn't a form type at all, the bare form list in UserController.
 */
class FormQueueDefaultDenyTest extends TestCase
{
    use DatabaseTransactions;

    private function clerkUser(): User
    {
        $role = Role::firstWhere('role', 'clerk');
        $this->assertNotNull($role, 'the clerk role must be seeded');

        return User::create([
            'first_name' => 'Queue', 'last_name' => 'Deny',
            'email' => 'queue.deny.' . uniqid() . '@demo.invalid',
            'password' => bcrypt('irrelevant'), 'phone' => '0000000000',
            'role_id' => $role->id, 'current_role_id' => $role->id, 'default_role_id' => $role->id,
        ]);
    }

    public static function formTypes(): array
    {
        return [
            ['presentation'],
            ['irb-constitution'],
        ];
    }

    /** @dataProvider formTypes */
    public function test_a_clerk_is_refused_a_scholars_form_queue(string $type): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAs($this->clerkUser(), 'sanctum');

        $this->getJson("/api/students/{$student->roll_no}/forms/{$type}")
            ->assertStatus(403);
    }

    public function test_a_clerk_is_refused_the_bare_form_list(): void
    {
        $student = Student::query()->firstOrFail();
        $this->actingAs($this->clerkUser(), 'sanctum');

        $this->getJson("/api/students/{$student->roll_no}/forms")
            ->assertStatus(403);
    }
}
