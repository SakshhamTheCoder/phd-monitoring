<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The filter bar sends one condition per value, so a field the user gave two
 * values to arrives as two conditions naming the same key.
 *
 * Two values on one field widen it: either matches. Values on two fields narrow
 * each other: both must match. Getting this backwards makes a second value on a
 * field return nothing at all, which is what an AND of two departments does.
 */
class FilterGroupingTest extends TestCase
{
    use DatabaseTransactions;

    private function userOn(string $role, array $attributes = []): User
    {
        $roleId = Role::where('role', $role)->value('id');
        $this->assertNotNull($roleId, "the {$role} role must be seeded");

        $user = new User();
        $user->forceFill($attributes + [
            'first_name' => 'Filter',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(12)) . '@grouping.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    /** /api/users?filters=... with the conditions the bar would send. */
    private function listWith(array $conditions): \Illuminate\Testing\TestResponse
    {
        return $this->getJson('/api/users?rows=100&filters=' . urlencode(json_encode([
            'combine' => 'and',
            'conditions' => $conditions,
        ])));
    }

    public function test_one_field_widens_and_two_fields_narrow(): void
    {
        $admin = $this->userOn('admin');
        $this->assertTrue($admin->may('can_manage_users'), 'the admin role must manage users');

        $first = $this->userOn('student', ['phone' => '9770000001', 'status' => 'active']);
        $second = $this->userOn('student', ['phone' => '9770000002', 'status' => 'active']);
        $third = $this->userOn('student', ['phone' => '9770000003', 'status' => 'inactive']);

        $this->actingAs($admin, 'sanctum');

        // Two values on one field: either phone, and nothing else.
        $this->listWith([
            ['key' => 'phone', 'op' => '=', 'value' => $first->phone],
            ['key' => 'phone', 'op' => '=', 'value' => $second->phone],
        ])->assertOk()
            ->assertJsonFragment(['id' => $first->id])
            ->assertJsonFragment(['id' => $second->id])
            ->assertJsonMissing(['id' => $third->id]);

        // Two fields: the phone must match and the status must match too, so the
        // active account drops out against an inactive status.
        $this->listWith([
            ['key' => 'phone', 'op' => '=', 'value' => $first->phone],
            ['key' => 'status', 'op' => '=', 'value' => 'inactive'],
        ])->assertOk()->assertJsonMissing(['id' => $first->id]);

        // Both at once: either phone, but only the one that is also inactive.
        $this->listWith([
            ['key' => 'phone', 'op' => '=', 'value' => $first->phone],
            ['key' => 'phone', 'op' => '=', 'value' => $third->phone],
            ['key' => 'status', 'op' => '=', 'value' => 'inactive'],
        ])->assertOk()
            ->assertJsonFragment(['id' => $third->id])
            ->assertJsonMissing(['id' => $first->id]);
    }
}
