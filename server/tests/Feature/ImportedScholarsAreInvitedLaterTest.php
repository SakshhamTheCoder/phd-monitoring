<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use App\Notifications\WelcomeResetPassword;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A bulk import mails nobody, and the office sends the links when it means to.
 *
 * A reset link lives 24 hours. Importing the institute's sheet mails one to
 * every scholar on it the moment the file is uploaded, days before anyone has
 * been told the portal exists, so they all expire unused and the office has to
 * send them again anyway.
 *
 * Who still needs one is not remembered anywhere new: an account with no
 * password set is one nobody has claimed.
 */
class ImportedScholarsAreInvitedLaterTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $office;

    protected function setUp(): void
    {
        parent::setUp();

        Notification::fake();

        $this->department = Department::firstOrCreate(
            ['code' => 'CINV'],
            ['name' => 'Invited Later Test Department']
        );

        $this->office = $this->userAs('admin', [
            'can_manage_students' => 'true',
            'can_read_all_students' => 'true',
            'can_manage_users' => 'true',
        ]);
    }

    private function userAs(string $role, array $capabilities = []): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => 'Invite',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@invited.test',
            'password' => 'secret-password',
            'password_set_at' => now(),
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function row(string $roll, string $email): array
    {
        return [
            'full_name' => 'Invited Scholar ' . $roll,
            'email' => $email,
            'roll_no' => $roll,
            'phone' => '98000' . $roll,
            'department_code' => 'CINV',
            'date_of_registration' => '2021-08-01',
            'current_status' => 'full-time',
        ];
    }

    private function import(array $rows, array $extra = [])
    {
        return $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/students/bulk-upload', array_merge(['students' => $rows], $extra));
    }

    private function twoScholars(): void
    {
        $this->import([
            $this->row('991101', 'invited.one@thapar.test'),
            $this->row('991102', 'invited.two@thapar.test'),
        ], ['import_batch' => 'batch-under-test'])->assertStatus(200);
    }

    public function test_an_import_mails_nobody(): void
    {
        $this->twoScholars();

        Notification::assertNothingSent();

        foreach (['991101', '991102'] as $roll) {
            $this->assertNull(Student::where('roll_no', $roll)->firstOrFail()->user->password_set_at);
        }
    }

    /** The same import, when the office does want the links sent at the time. */
    public function test_an_import_asked_to_invite_still_does(): void
    {
        $this->import([$this->row('991103', 'invited.three@thapar.test')], ['send_invites' => true])
            ->assertStatus(200);

        Notification::assertSentTo(
            User::where('email', 'invited.three@thapar.test')->firstOrFail(),
            WelcomeResetPassword::class
        );
    }

    public function test_the_office_is_told_how_many_cannot_sign_in_yet(): void
    {
        $everyoneBefore = $this->actingAs($this->office, 'sanctum')
            ->getJson('/api/users/sign-in-links')->assertStatus(200)->json('everyone.count');

        $this->twoScholars();

        $response = $this->actingAs($this->office, 'sanctum')
            ->getJson('/api/users/sign-in-links')->assertStatus(200);

        $this->assertSame($everyoneBefore + 2, $response->json('everyone.count'));

        $run = collect($response->json('runs'))->firstWhere('batch', 'batch-under-test');
        $this->assertNotNull($run, 'the run just done is offered by name');
        $this->assertSame(2, $run['waiting']);
    }

    /**
     * The default scope is the import just run, not every scholar who has
     * never signed in. An older import's stragglers are a separate decision.
     */
    public function test_the_links_go_to_the_run_the_office_picks(): void
    {
        $this->import([$this->row('991201', 'invited.older@thapar.test')], ['import_batch' => 'batch-older'])
            ->assertStatus(200);

        $this->travel(1)->minutes();

        $this->import([$this->row('991202', 'invited.newer@thapar.test')], ['import_batch' => 'batch-newer'])
            ->assertStatus(200);

        // The older run is still pickable: a second import does not bury it.
        $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/users/sign-in-links', ['batch' => 'batch-older'])
            ->assertStatus(200)
            ->assertJson(['count' => 1]);

        Notification::assertSentTo(
            User::where('email', 'invited.older@thapar.test')->firstOrFail(),
            WelcomeResetPassword::class
        );
        Notification::assertNotSentTo(
            User::where('email', 'invited.newer@thapar.test')->firstOrFail(),
            WelcomeResetPassword::class
        );
    }

    public function test_everyone_is_available_for_the_stragglers(): void
    {
        $this->import([$this->row('991203', 'invited.older2@thapar.test')], ['import_batch' => 'batch-older-2'])
            ->assertStatus(200);

        $this->travel(1)->minutes();

        $this->import([$this->row('991204', 'invited.newer2@thapar.test')], ['import_batch' => 'batch-newer-2'])
            ->assertStatus(200);

        $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/users/sign-in-links')
            ->assertStatus(200);

        foreach (['invited.older2@thapar.test', 'invited.newer2@thapar.test'] as $email) {
            Notification::assertSentTo(User::where('email', $email)->firstOrFail(), WelcomeResetPassword::class);
        }
    }

    /**
     * Google is a way in that never sets a password.
     *
     * A scholar who has been signing in with their institute Google account
     * since the day they arrived has no password and needs no link, and
     * mailing them one says the portal has lost track of them.
     */
    public function test_a_scholar_who_signs_in_with_google_is_left_alone(): void
    {
        $this->twoScholars();

        $google = Student::where('roll_no', '991101')->firstOrFail()->user;
        $google->forceFill(['email_verified_at' => now()])->save();

        $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/users/sign-in-links', ['batch' => 'batch-under-test'])
            ->assertStatus(200)
            ->assertJson(['count' => 1]);

        Notification::assertNotSentTo($google, WelcomeResetPassword::class);
    }

    public function test_sending_the_links_reaches_everyone_who_has_no_password(): void
    {
        $this->twoScholars();

        $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/users/sign-in-links')
            ->assertStatus(200);

        foreach (['invited.one@thapar.test', 'invited.two@thapar.test'] as $email) {
            Notification::assertSentTo(User::where('email', $email)->firstOrFail(), WelcomeResetPassword::class);
        }
    }

    /** A scholar who has already chosen a password is not mailed again. */
    public function test_a_scholar_who_has_signed_in_is_left_alone(): void
    {
        $this->twoScholars();

        $settled = Student::where('roll_no', '991101')->firstOrFail()->user;
        $settled->forceFill(['password_set_at' => now()])->save();

        $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/users/sign-in-links')
            ->assertStatus(200);

        Notification::assertNotSentTo($settled, WelcomeResetPassword::class);
        Notification::assertSentTo(
            User::where('email', 'invited.two@thapar.test')->firstOrFail(),
            WelcomeResetPassword::class
        );
    }

    /**
     * Everyone means every account without a way in, not every scholar.
     *
     * A departments import creates the clerks it names, with a password
     * nobody knows and no mail sent, so they are in exactly the same position
     * as an imported scholar and were being left out of the only thing that
     * lets anybody in.
     */
    public function test_everyone_reaches_the_clerks_an_import_created_too(): void
    {
        $this->twoScholars();

        $clerkRole = Role::where('role', 'clerk')->value('id')
            ?? DB::table('roles')->insertGetId(['role' => 'clerk', 'created_at' => now(), 'updated_at' => now()]);

        $clerk = new User();
        $clerk->forceFill([
            'first_name' => 'Office',
            'last_name' => 'Clerk',
            'email' => 'invited.clerk@thapar.test',
            'password' => 'unknown-to-anybody',
            'role_id' => $clerkRole,
            'current_role_id' => $clerkRole,
        ])->save();

        $counts = $this->actingAs($this->office, 'sanctum')
            ->getJson('/api/users/sign-in-links')->assertStatus(200)->json('everyone.by_role');
        $this->assertArrayHasKey('clerk', $counts);

        $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/users/sign-in-links', ['scope' => 'everyone'])
            ->assertStatus(200);

        Notification::assertSentTo($clerk->fresh(), WelcomeResetPassword::class);
    }

    public function test_only_the_office_may_send_them(): void
    {
        $outsider = $this->userAs('student');

        $this->actingAs($outsider, 'sanctum')->getJson('/api/users/sign-in-links')->assertStatus(403);
        $this->actingAs($outsider, 'sanctum')->postJson('/api/users/sign-in-links')->assertStatus(403);
    }
}
