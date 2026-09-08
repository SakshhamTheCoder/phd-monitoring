<?php

namespace Tests\Unit;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * availableRoles() used to write the derived list into `available_roles` on
 * first read and return it verbatim from then on. Changing a user's role_id
 * afterwards therefore left them unable to switch into the role they had just
 * been granted, because the frozen list did not contain it.
 */
class AvailableRolesTest extends TestCase
{
    use DatabaseTransactions;

    private function userWithBaseRole(string $role, ?array $override = null): User
    {
        $user = User::query()->firstOrFail();
        $user->role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->available_roles = $override;
        $user->save();

        return $user->fresh();
    }

    public function test_a_faculty_may_also_act_on_their_doctoral_committees(): void
    {
        $roles = $this->userWithBaseRole('faculty')->availableRoles();

        $this->assertEqualsCanonicalizing(['doctoral', 'faculty'], $roles);
    }

    public function test_an_hod_keeps_their_supervisor_and_committee_roles(): void
    {
        $roles = $this->userWithBaseRole('hod')->availableRoles();

        $this->assertEqualsCanonicalizing(['doctoral', 'faculty', 'hod'], $roles);
    }

    /** The bug: a promotion must not be blocked by a list cached before it. */
    public function test_a_stale_stored_list_does_not_hide_a_newly_granted_role(): void
    {
        $user = $this->userWithBaseRole('hod', ['doctoral', 'faculty']);

        $this->assertContains('hod', $user->availableRoles());
        $this->assertTrue($user->isAuthorized('hod'));
    }

    /** An explicit override still grants what it lists, e.g. a clerk account. */
    public function test_an_override_is_kept(): void
    {
        $roles = $this->userWithBaseRole('faculty', ['clerk'])->availableRoles();

        $this->assertContains('clerk', $roles);
        $this->assertContains('faculty', $roles);
    }

    /** Reading the roles must not write to the row. */
    public function test_reading_the_roles_does_not_persist_them(): void
    {
        $user = $this->userWithBaseRole('faculty');

        $user->availableRoles();

        $this->assertNull($user->fresh()->getAttributes()['available_roles']);
    }
}
