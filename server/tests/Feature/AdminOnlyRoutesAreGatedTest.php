<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * Admin form management, bulk password resets and outside expert management
 * carried no check at all, so any signed-in account could move a scholar's form
 * to another stage, delete it, or send reset mail to every user.
 */
class AdminOnlyRoutesAreGatedTest extends TestCase
{
    use DatabaseTransactions;

    private const ROUTES = [
        ['GET', '/api/admin/forms/student/999101'],
        ['POST', '/api/admin/forms/create'],
        ['POST', '/api/admin/forms/update-control'],
        ['POST', '/api/admin/forms/toggle-availability'],
        ['POST', '/api/admin/forms/update-stage'],
        ['POST', '/api/admin/forms/disable'],
        ['DELETE', '/api/admin/forms/delete'],
        ['POST', '/api/admin/bulk-forgot-password'],
        ['GET', '/api/outside-experts/list'],
        ['GET', '/api/outside-experts/filters'],
        ['POST', '/api/outside-experts/add'],
        ['POST', '/api/outside-experts/bulk-import'],
        ['PUT', '/api/outside-experts/update/1'],
        ['DELETE', '/api/outside-experts/delete/1'],
    ];

    private function account(string $role): User
    {
        $user = User::where('email', "{$role}@fixture.test")->first();
        if (!$user) {
            $this->markTestSkipped("No {$role}@fixture.test account. Seed TestFixturesSeeder.");
        }
        return $user;
    }

    public function test_no_other_role_reaches_them(): void
    {
        Queue::fake();

        foreach (['student', 'faculty', 'hod', 'dordc', 'director', 'clerk', 'ug_student'] as $role) {
            $this->actingAs($this->account($role));
            foreach (self::ROUTES as [$method, $uri]) {
                $this->assertSame(403, $this->json($method, $uri)->status(), "{$role} reached {$method} {$uri}");
            }
        }

        Queue::assertNothingPushed();
    }

    public function test_admin_still_reaches_them(): void
    {
        Queue::fake();
        $this->actingAs($this->account('admin'));

        foreach (self::ROUTES as [$method, $uri]) {
            $this->assertNotSame(403, $this->json($method, $uri)->status(), "admin refused {$method} {$uri}");
        }
    }
}
