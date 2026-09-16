<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Semester;
use App\Http\Controllers\UgSignupController;
use App\Models\UgBranch;
use App\Models\UgStudent;
use App\Models\UrfApplication;
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

    private function branch(): UgBranch
    {
        // One branch for the whole test, however many forms are built from it.
        return UgBranch::firstOrCreate(
            ['programme' => 'BE', 'code' => 'SGNTB'],
            ['name' => 'Signup Test Branch'],
        );
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
            'branch_id' => $this->branch()->id,
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
        $this->assertSame($form['branch_id'], $record->branch_id);
        // Counted from the address rather than asked for.
        $this->assertSame(2023, (int) $record->admission_year);
        $this->assertNull($record->year, 'nothing to correct');
        $this->assertSame(Semester::yearOfStudy(2023), $record->year_of_study);
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

    public function test_a_student_corrects_their_own_details_until_they_apply(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();
        $student = User::where('email', $form['email'])->first();
        $student->forceFill(['email_verified_at' => now()])->save();
        $other = UgBranch::create(['programme' => 'BTech', 'code' => 'SGNT2', 'name' => 'Second Branch']);

        $this->actingAs($student, 'sanctum')->patchJson('/api/urf/me', [
            'phone' => '9000000000',
            'gender' => 'Female',
            'roll_no' => '102299999',
            'branch_id' => $other->id,
            'year' => 4,
        ])->assertOk()->assertJsonPath('roll_no', '102299999');

        $record = $student->fresh()->ugStudent;
        $this->assertSame($other->id, $record->branch_id);
        $this->assertSame(4, (int) $record->year, 'the correction sticks');
        $this->assertSame('9000000000', $student->fresh()->phone);

        // Once there is an application the details belong to a record the
        // admin is reading, so they are the office's to change.
        (new UrfApplication())->forceFill([
            'user_id' => $student->id,
            'session' => (int) now()->year,
            'project_title' => 'Anything',
            'student1_name' => $student->name(),
            'student1_email' => $student->email,
            'proposal' => 'x.pdf',
        ])->save();

        $this->actingAs($student, 'sanctum')->patchJson('/api/urf/me', [
            'phone' => '9111111111',
            'gender' => 'Male',
            'roll_no' => '102288888',
            'branch_id' => $other->id,
        ])->assertStatus(422);

        $this->assertSame('102299999', $student->fresh()->ugStudent->roll_no);
    }

    public function test_a_google_account_sets_a_password_without_being_asked_for_one(): void
    {
        Mail::fake();
        $email = Str::lower(Str::random(10)) . '_be23@thapar.edu';
        $form = $this->form(['google_ticket' => UgSignupController::issueGoogleTicket($email, 'Nikhil Verma')]);
        unset($form['password'], $form['password_confirmation']);
        $this->postJson('/api/urf/signup', $form)->assertCreated();

        $user = User::where('email', $email)->first();
        $this->assertNull($user->password_set_at, 'nobody chose that password');

        $this->actingAs($user, 'sanctum')->postJson('/api/change-password', [
            'password' => 'a-chosen-password',
            'password_confirmation' => 'a-chosen-password',
        ])->assertOk();

        $this->assertNotNull($user->fresh()->password_set_at);
        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/login', ['email' => $email, 'password' => 'a-chosen-password'])
            ->assertOk()
            ->assertJsonPath('user.password_set', true);
    }

    public function test_an_account_with_a_password_has_to_give_the_old_one(): void
    {
        Mail::fake();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();
        $user = User::where('email', $form['email'])->first();
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($user, 'sanctum')->postJson('/api/change-password', [
            'password' => 'another-password',
            'password_confirmation' => 'another-password',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->actingAs($user, 'sanctum')->postJson('/api/change-password', [
            'current_password' => 'wrong-one',
            'password' => 'another-password',
            'password_confirmation' => 'another-password',
        ])->assertStatus(422)->assertJsonValidationErrors('current_password');

        $this->actingAs($user, 'sanctum')->postJson('/api/change-password', [
            'current_password' => $form['password'],
            'password' => 'another-password',
            'password_confirmation' => 'another-password',
        ])->assertOk();

        $this->app['auth']->shouldUse('web');
        $this->postJson('/api/login', ['email' => $form['email'], 'password' => 'another-password'])->assertOk();
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
            ->assertJsonPath('student.branch.name', 'Signup Test Branch')
            ->assertJsonPath('student.year_of_study', Semester::yearOfStudy(2023));
    }

    public function test_only_an_admin_manages_the_branch_list(): void
    {
        Mail::fake();
        $branch = $this->branch();
        $form = $this->form();
        $this->postJson('/api/urf/signup', $form)->assertCreated();
        $student = User::where('email', $form['email'])->first();
        $student->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($student, 'sanctum')->postJson('/api/ug-branches', [
            'programme' => 'BE', 'code' => 'NOPE', 'name' => 'Not For Students',
        ])->assertForbidden();

        $adminRole = Role::where('role', 'admin')->value('id');
        DB::table('roles')->where('id', $adminRole)->update(['can_manage_app_settings' => 'true']);
        $admin = User::where('current_role_id', $adminRole)->first();

        $this->actingAs($admin, 'sanctum')->postJson('/api/ug-branches', [
            'programme' => 'BTech', 'code' => 'SGNTB', 'name' => 'Another Branch',
        ])->assertCreated();

        // The same code under the same programme is the one clash that matters.
        $this->actingAs($admin, 'sanctum')->postJson('/api/ug-branches', [
            'programme' => 'BE', 'code' => 'SGNTB', 'name' => 'Clashing Branch',
        ])->assertStatus(422)->assertJsonValidationErrors('code');

        // A branch students are on stays where it is.
        $this->actingAs($admin, 'sanctum')->deleteJson("/api/ug-branches/{$branch->id}")->assertStatus(422);
    }

    public function test_the_branch_list_is_open_to_a_student_with_no_account_yet(): void
    {
        $this->branch();

        $this->getJson('/api/urf/branches')->assertOk()->assertJsonStructure([['id', 'programme', 'code', 'name']]);
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
