<?php

namespace Tests\Feature;

use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * These five endpoints required no authentication at all: an unauthenticated
 * caller could create an account, mint a role, or trigger a welcome email for
 * any address. The fix was deletion, not a gate, so the regression to watch
 * for is the route coming back at all, gated or not. No signed-in user is
 * used here on purpose: the point is that the route itself is gone, not that
 * some role is refused it.
 */
class DeletedRoutesStayDeletedTest extends TestCase
{
    /** 405 covers a URI that still matches a route, just not this verb. */
    private function assertRouteIsGone(TestResponse $response, string $endpoint): void
    {
        $this->assertContains(
            $response->getStatusCode(),
            [404, 405],
            "{$endpoint} responded with {$response->getStatusCode()}; it should no longer exist."
        );
    }

    public function test_register_is_gone(): void
    {
        $this->assertRouteIsGone(
            $this->postJson('/api/register', ['email' => 'nobody@example.test', 'password' => 'irrelevant']),
            'POST /api/register'
        );
    }

    public function test_create_role_is_gone(): void
    {
        $this->assertRouteIsGone(
            $this->postJson('/api/create-role', ['role' => 'admin']),
            'POST /api/create-role'
        );
    }

    public function test_send_welcome_is_gone(): void
    {
        $this->assertRouteIsGone(
            $this->getJson('/api/send-welcome'),
            'GET /api/send-welcome'
        );
    }

    public function test_roles_add_is_gone(): void
    {
        $this->assertRouteIsGone(
            $this->postJson('/api/roles/add', ['role' => 'admin']),
            'POST /api/roles/add'
        );
    }

    public function test_bare_supervisors_is_gone(): void
    {
        $this->assertRouteIsGone(
            $this->getJson('/api/supervisors'),
            'GET /api/supervisors'
        );
    }
}
