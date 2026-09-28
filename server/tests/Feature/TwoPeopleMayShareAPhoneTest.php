<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * A phone number is not an identity.
 *
 * It used to carry a unique index, so the second person to give a number was
 * refused. The institute's scholar sheet has sisters on one number, and a lab
 * or household line is ordinary, so a real scholar was losing their record
 * over a field nothing is matched on: people are found by email and
 * registration number.
 */
class TwoPeopleMayShareAPhoneTest extends TestCase
{
    use DatabaseTransactions;

    public function test_a_second_account_may_carry_a_phone_already_in_use(): void
    {
        $admin = User::whereHas('role', fn ($query) => $query->where('role', 'admin'))->first();
        $taken = User::whereNotNull('phone')->where('phone', '<>', '')->first();
        if (!$admin || !$taken) {
            $this->markTestSkipped('No admin, or no account with a phone number.');
        }

        $this->actingAs($admin)->postJson('/api/users', [
            'full_name' => 'Shared Phone Probe',
            'email' => 'shared.phone.probe@fixture.test',
            'phone' => $taken->phone,
            'role_id' => Role::where('role', 'admin')->value('id'),
        ])->assertSuccessful();

        $created = User::where('email', 'shared.phone.probe@fixture.test')->first();
        $this->assertNotNull($created);
        $this->assertSame($taken->phone, $created->phone);
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
