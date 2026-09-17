<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * users.phone carries a unique index, but nothing validated it: creating a
 * second account with a phone already in use answered a raw 500 with an SQL
 * message instead of telling the office which field to change.
 */
class DuplicatePhoneIsRefusedTest extends TestCase
{
    use DatabaseTransactions;

    public function test_creating_a_user_with_a_phone_already_in_use_is_a_validation_error(): void
    {
        $admin = User::whereHas('role', fn ($query) => $query->where('role', 'admin'))->first();
        $taken = User::whereNotNull('phone')->where('phone', '<>', '')->first();
        if (!$admin || !$taken) {
            $this->markTestSkipped('No admin, or no account with a phone number.');
        }

        $this->actingAs($admin)->postJson('/api/users', [
            'full_name' => 'Duplicate Phone Probe',
            'email' => 'duplicate.phone.probe@fixture.test',
            'phone' => $taken->phone,
            'role_id' => Role::where('role', 'admin')->value('id'),
        ])->assertStatus(422)->assertJsonValidationErrors('phone');

        $this->assertNull(User::where('email', 'duplicate.phone.probe@fixture.test')->first());
    }

    public function test_saving_an_account_with_its_own_phone_unchanged_is_allowed(): void
    {
        $admin = User::whereHas('role', fn ($query) => $query->where('role', 'admin'))
            ->whereNotNull('phone')->where('phone', '<>', '')->first();
        if (!$admin) {
            $this->markTestSkipped('No admin with a phone number.');
        }

        $this->actingAs($admin)->postJson('/api/users', [
            'id' => $admin->id,
            'full_name' => $admin->name(),
            'email' => $admin->email,
            'phone' => $admin->phone,
            'role_id' => $admin->role_id,
        ])->assertSuccessful();
    }
}
