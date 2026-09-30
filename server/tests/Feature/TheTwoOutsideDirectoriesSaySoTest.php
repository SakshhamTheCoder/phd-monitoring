<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\OutsideExpert;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Somebody from outside the institute can be two things here, and the office is
 * told which one they already are.
 *
 * A supervisor guiding from another institute is faculty, signs in and holds a
 * seat. An outside expert signs in nowhere and answers one tokened link for a
 * scholar's IRB. The same person can be both, so neither record refuses the
 * other; making the second one says the first exists.
 */
class TheTwoOutsideDirectoriesSaySoTest extends TestCase
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

    public function test_adding_faculty_for_an_outside_expert_says_so(): void
    {
        $this->admin();
        Mail::fake();

        OutsideExpert::create([
            'first_name' => 'Sanjeev',
            'last_name' => 'Bedi',
            'designation' => 'Professor',
            'department' => 'Mechanical',
            'institution' => 'University of Waterloo',
            'email' => 'both.roles@demo.invalid',
        ]);

        $response = $this->postJson('/api/faculty/bulk-import-external', ['rows' => [[
            '_rowNumber' => 2,
            'Full Name' => 'Dr. Sanjeev Bedi',
            'Email' => 'both.roles@demo.invalid',
            'Designation' => 'Professor',
            'Department Code' => 'CSED',
            'Institution' => 'University of Waterloo',
        ]]]);

        $response->assertOk();
        $this->assertSame(1, $response->json('data.success_count'));
        // A note about a row that landed, not a refusal.
        $this->assertSame(0, $response->json('data.error_count'));
        $this->assertStringContainsString('already an outside expert', $response->json('data.errors.0'));
    }

    public function test_adding_an_outside_expert_for_a_faculty_member_says_so(): void
    {
        $this->admin();

        $faculty = Faculty::with('user')->whereHas('user')->firstOrFail();

        $response = $this->postJson('/api/outside-experts/add', [
            'full_name' => $faculty->user->name(),
            'designation' => 'Professor',
            'department' => 'Mechanical',
            'institution' => 'IIT Delhi',
            'email' => $faculty->user->email,
        ]);

        $response->assertCreated();
        $this->assertStringContainsString('is already', $response->json('message'));
        $this->assertStringContainsString('IRB external expert', $response->json('message'));
    }

    public function test_an_expert_is_a_name_and_an_address_and_nothing_else(): void
    {
        $this->admin();

        $response = $this->postJson('/api/outside-experts/add', [
            'full_name' => 'Dr. Nowhere In Particular',
            'email' => 'nowhere@demo.invalid',
        ]);

        $response->assertCreated();

        $expert = OutsideExpert::where('email', 'nowhere@demo.invalid')->firstOrFail();
        $this->assertNull($expert->institution);
        $this->assertNull($expert->designation);
        $this->assertNull($expert->department);
    }

    public function test_a_new_address_is_told_nothing(): void
    {
        $this->admin();

        $response = $this->postJson('/api/outside-experts/add', [
            'full_name' => 'Dr. Nobody Here',
            'designation' => 'Professor',
            'department' => 'Physics',
            'institution' => 'IIT Delhi',
            'email' => 'nobody.here@demo.invalid',
        ]);

        $response->assertCreated();
        $this->assertSame('Outside expert added successfully', $response->json('message'));
    }
}
