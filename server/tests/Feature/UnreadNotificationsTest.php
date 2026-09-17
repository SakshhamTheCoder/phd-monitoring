<?php

namespace Tests\Feature;

use App\Models\Notifications;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The header asks for this on every page. It now filters in the database
 * instead of loading every notification the account ever had.
 */
class UnreadNotificationsTest extends TestCase
{
    use DatabaseTransactions;

    public function test_only_unread_notifications_for_the_acting_role_or_no_role(): void
    {
        $user = User::where('email', 'hod@fixture.test')->first();
        if (!$user) {
            $this->markTestSkipped('No hod@fixture.test. Seed TestFixturesSeeder.');
        }
        Notifications::where('user_id', $user->id)->delete();
        $hod = Role::where('role', 'hod')->value('id');
        $faculty = Role::where('role', 'faculty')->value('id');

        $make = fn (array $attributes) => Notifications::forceCreate(array_merge([
            'user_id' => $user->id, 'title' => 'probe', 'body' => 'probe', 'link' => '/home', 'is_read' => false, 'role_id' => null,
        ], $attributes));
        $common = $make(['title' => 'common']);
        $asHod = $make(['title' => 'as hod', 'role_id' => $hod]);
        $make(['title' => 'as faculty', 'role_id' => $faculty]);
        $make(['title' => 'already read', 'role_id' => $hod, 'is_read' => true]);

        $titles = collect($this->actingAs($user)->getJson('/api/notifications/unread')->assertOk()->json())
            ->pluck('title')->sort()->values()->all();

        $this->assertSame(['As hod', 'Common'], $titles);
        $this->assertNotNull($asHod->fresh());
        $this->assertNotNull($common->fresh());
    }
}
