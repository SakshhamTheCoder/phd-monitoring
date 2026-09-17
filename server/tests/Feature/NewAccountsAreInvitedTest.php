<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Notifications\CustomResetPassword;
use App\Notifications\WelcomeResetPassword;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Every account the office creates is mailed a link to choose its password.
 * Only the UG pages did this, so a new student, faculty member or officer had
 * to be told a generated password some other way.
 */
class NewAccountsAreInvitedTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $admin = User::whereHas('current_role', fn ($query) => $query->where('role', 'admin'))->first();
        if (!$admin) {
            $this->markTestSkipped('No admin account.');
        }

        return $admin;
    }

    public function test_an_account_created_without_a_password_is_invited(): void
    {
        Notification::fake();
        $stamp = uniqid();

        $this->actingAs($this->admin())->postJson('/api/users', [
            'full_name' => 'Invited Officer',
            'email' => "invited.{$stamp}@fixture.test",
            'phone' => '9' . substr((string) time(), -9),
            'role_id' => Role::where('role', 'dra')->value('id'),
        ])->assertSuccessful()->assertJsonPath('password', null);

        $created = User::where('email', "invited.{$stamp}@fixture.test")->firstOrFail();
        // Never chosen, so Change Password does not ask for one they were never given.
        $this->assertNull($created->password_set_at);
        Notification::assertSentTo($created, WelcomeResetPassword::class);
    }

    public function test_an_account_the_office_gave_a_password_is_not_invited(): void
    {
        Notification::fake();
        $stamp = uniqid();

        $this->actingAs($this->admin())->postJson('/api/users', [
            'full_name' => 'Handed Over Officer',
            'email' => "handed.{$stamp}@fixture.test",
            'phone' => '8' . substr((string) time(), -9),
            'role_id' => Role::where('role', 'dra')->value('id'),
            'password' => 'HandedOver#2026',
        ])->assertSuccessful()->assertJsonPath('password', 'HandedOver#2026');

        $created = User::where('email', "handed.{$stamp}@fixture.test")->firstOrFail();
        $this->assertNotNull($created->password_set_at);
        Notification::assertNothingSentTo($created);
    }

    public function test_a_new_student_is_invited(): void
    {
        Notification::fake();
        $stamp = uniqid();
        $department = Department::first();
        if (!$department) {
            $this->markTestSkipped('No departments.');
        }

        $this->actingAs($this->admin())->postJson('/api/students/add', [
            'full_name' => 'Invited Scholar',
            'email' => "scholar.{$stamp}@fixture.test",
            'phone' => '7' . substr((string) time(), -9),
            'roll_no' => '9' . substr((string) time(), -6),
            'department_id' => $department->id,
            'date_of_registration' => '2026-08-01',
            'current_status' => 'full-time',
            'gender' => 'Male',
        ])->assertSuccessful();

        $created = User::where('email', "scholar.{$stamp}@fixture.test")->firstOrFail();
        Notification::assertSentTo($created, WelcomeResetPassword::class);
    }

    public function test_someone_who_already_chose_a_password_gets_the_reset_mail_instead(): void
    {
        Notification::fake();
        $user = User::whereNotNull('password_set_at')->firstOrFail();

        $this->postJson('/api/forgot-password', ['email' => $user->email])->assertOk();

        Notification::assertSentTo($user, CustomResetPassword::class);
    }
}
