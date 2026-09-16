<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Http\Controllers\UgSignupController;
use App\Models\UgStudent;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Signing up as a UG student: who may, what it writes, and the confirmed
 * address standing between the new account and the portal.
 */
class UgSignupTest extends TestCase
{
    use DatabaseTransactions;

    private function department(): Department
    {
        return Department::create(['name' => 'Signup Test Department', 'code' => 'SGNTD']);
    }

    private function form(array $overrides = []): array
    {
        return array_merge([
            'first_name' => 'Nikhil',
            'last_name' => 'Verma',
            'email' => Str::lower(Str::random(10)) . '_be23@thapar.edu',
            'phone' => '9876500000',
            'gender' => 'Male',
            'password' => 'a-good-password',
            'password_confirmation' => 'a-good-password',
            'roll_no' => (string) random_int(102200000, 102299999),
            'department_id' => $this->department()->id,
            'year' => 2,
        ], $overrides);
    }

    public function test_signing_up_creates_the_account_and_its_record(): void
    {
        Mail::fake();
        $form = $this->form();

        $this->postJson('/api/urf/signup', $form)->assertCreated();

        $user = User::where('email', $form['email'])->first();
        $this->assertNotNull($user);
        $this->assertSame('ug_student', $user->current_role->role);
        $this->assertNull($user->email_verified_at, 'the address is not taken on trust');
        $this->assertNotSame($form['password'], $user->password, 'the password is hashed');

        $record = $user->ugStudent;
        $this->assertSame($form['roll_no'], $record->roll_no);
        $this->assertSame($form['department_id'], $record->department_id);
        $this->assertSame(2, (int) $record->year);
    }

    public function test_it_refuses_an_outside_address_a_taken_one_and_a_taken_roll_number(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();

        $this->postJson('/api/urf/signup', $this->form(['email' => 'someone@gmail.com']))
            ->assertStatus(422)->assertJsonValidationErrors('email');

        // An institute address that is not an undergraduate's: a scholar or a
        // member of staff is given an account by the office.
        $this->postJson('/api/urf/signup', $this->form(['email' => 'arun_phd21@thapar.edu']))
            ->assertStatus(422)->assertJsonValidationErrors('email');
        $this->postJson('/api/urf/signup', $this->form(['email' => 'arun.mehta@thapar.edu']))
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $this->postJson('/api/urf/signup', $this->form(['email' => $form['email']]))
            ->assertStatus(422)->assertJsonValidationErrors('email');

        $this->postJson('/api/urf/signup', $this->form(['roll_no' => $form['roll_no']]))
            ->assertStatus(422)->assertJsonValidationErrors('roll_no');

        $this->assertSame(1, User::where('email', $form['email'])->count());
    }

    public function test_a_ug_student_signs_in_only_once_the_link_is_answered(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();

        $this->postJson('/api/login', ['email' => $form['email'], 'password' => $form['password']])
            ->assertStatus(403)
            ->assertJsonPath('unverified', true);

        $user = User::where('email', $form['email'])->first();
        $link = URL::temporarySignedRoute('urf.verify-email', now()->addDay(), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);
        $this->get($link)->assertRedirectContains('verified=1');
        $this->assertNotNull($user->fresh()->email_verified_at);

        $this->postJson('/api/login', ['email' => $form['email'], 'password' => $form['password']])
            ->assertOk()
            ->assertJsonPath('user.role.role', 'ug_student');
    }

    public function test_a_tampered_link_verifies_nobody(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();
        $user = User::where('email', $form['email'])->first();

        $unsigned = route('urf.verify-email', ['id' => $user->id, 'hash' => sha1($user->email)]);
        $this->get($unsigned)->assertForbidden();

        $wrongHash = URL::temporarySignedRoute('urf.verify-email', now()->addDay(), [
            'id' => $user->id,
            'hash' => sha1('someone.else@thapar.edu'),
        ]);
        $this->get($wrongHash)->assertRedirectContains('verified=invalid');

        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_an_unverified_phd_account_still_signs_in(): void
    {
        $roleId = Role::where('role', 'student')->value('id');
        $user = new User();
        $user->forceFill([
            'first_name' => 'Old',
            'last_name' => 'Account',
            'email' => Str::lower(Str::random(10)) . '_be23@thapar.edu',
            'password' => bcrypt('a-good-password'),
            'role_id' => $roleId,
            'current_role_id' => $roleId,
            'email_verified_at' => null,
        ])->save();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'a-good-password'])->assertOk();
    }

    public function test_a_google_signup_needs_no_password_and_no_confirmation(): void
    {
        Mail::fake();
        $email = Str::lower(Str::random(10)) . '_btech23@thapar.edu';
        $form = $this->form([
            'email' => 'someone.else@thapar.edu',
            'google_ticket' => UgSignupController::issueGoogleTicket($email, 'Nikhil Verma'),
        ]);
        unset($form['password'], $form['password_confirmation']);

        $this->postJson('/api/urf/signup', $form)->assertCreated()->assertJsonPath('verified', true);

        // The ticket names the address, so what the form said is beside the point.
        $user = User::where('email', $email)->first();
        $this->assertNotNull($user);
        $this->assertNotNull($user->email_verified_at, 'Google already asked who this is');
        $this->assertNull(User::where('email', 'someone.else@thapar.edu')->first());
        Mail::assertNothingSent();
    }

    public function test_a_forged_or_stale_google_ticket_creates_nobody(): void
    {
        Mail::fake();
        $form = $this->form(['google_ticket' => 'not-a-real-ticket']);
        unset($form['password'], $form['password_confirmation']);

        $this->postJson('/api/urf/signup', $form)->assertStatus(422);
        $this->assertSame(0, User::where('email', $form['email'])->count());

        $this->travel(16)->minutes();
        $stale = $this->form([
            'google_ticket' => UgSignupController::issueGoogleTicket('late_be23@thapar.edu', 'Late Arrival'),
        ]);
        unset($stale['password'], $stale['password_confirmation']);
        $this->travel(16)->minutes();

        $this->postJson('/api/urf/signup', $stale)->assertStatus(422);
        $this->assertSame(0, User::where('email', 'late_be23@thapar.edu')->count());
    }

    public function test_a_deactivated_account_cannot_sign_in(): void
    {
        $roleId = Role::where('role', 'student')->value('id');
        $user = new User();
        $user->forceFill([
            'first_name' => 'Left',
            'last_name' => 'Institute',
            'email' => Str::lower(Str::random(10)) . '_be23@thapar.edu',
            'password' => bcrypt('a-good-password'),
            'role_id' => $roleId,
            'current_role_id' => $roleId,
            'status' => 'inactive',
        ])->save();

        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'a-good-password'])
            ->assertStatus(403);

        $user->forceFill(['status' => 'active'])->save();
        $this->postJson('/api/login', ['email' => $user->email, 'password' => 'a-good-password'])->assertOk();
    }

    public function test_the_application_takes_the_roll_number_from_the_account(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();
        $user = User::where('email', $form['email'])->first();
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($user, 'sanctum')->getJson('/api/urf/mine')
            ->assertOk()
            ->assertJsonPath('student.roll_no', $form['roll_no'])
            ->assertJsonPath('student.department.name', 'Signup Test Department');
    }

    public function test_the_branch_list_is_open_to_a_student_with_no_account_yet(): void
    {
        $this->department();

        $this->getJson('/api/urf/departments')->assertOk()->assertJsonStructure([['id', 'name']]);
    }

    public function test_asking_for_the_link_again_says_nothing_about_who_has_an_account(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();

        $known = $this->postJson('/api/urf/resend-verification', ['email' => $form['email']])->assertOk();
        $unknown = $this->postJson('/api/urf/resend-verification', ['email' => 'nobody@thapar.edu'])->assertOk();

        $this->assertSame($known->json('message'), $unknown->json('message'));
    }
}
