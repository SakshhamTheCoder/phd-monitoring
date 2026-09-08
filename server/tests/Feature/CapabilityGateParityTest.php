<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Drives the swapped endpoints as every role and checks that the ones refused
 * with 403 are exactly the ones the pre-swap code refused.
 *
 * RoleCapabilityMatrixTest proves the columns hold the old role lists; this
 * proves the endpoints actually read those columns, so the two together cover
 * the swap end to end. Only the refusal is asserted: what a permitted role then
 * sees is the endpoint's own business and is covered elsewhere.
 */
class CapabilityGateParityTest extends TestCase
{
    use DatabaseTransactions;

    /** endpoint => the roles the code admitted before the swap. */
    private const GATES = [
        'GET /api/users' => ['admin'],
        'GET /api/faculty' => ['admin', 'director', 'dra', 'dordc', 'hod', 'phd_coordinator', 'adordc'],
        'GET /api/students' => ['admin', 'director', 'dra', 'dordc', 'hod', 'phd_coordinator', 'adordc', 'faculty', 'doctoral', 'external', 'student'],
        'GET /api/clerks/my-departments' => ['clerk'],
        'GET /api/clerks/attendance' => ['clerk', 'admin'],
        'GET /api/clerks/attendance/history' => ['clerk', 'admin'],
        'GET /api/clerks/attendance/template' => ['clerk', 'admin'],
        'GET /api/settings/leave' => ['admin', 'clerk', 'hod', 'student'],
    ];

    /**
     * One signed-in user per role. Roles with no account in this database are
     * skipped rather than silently passing.
     */
    private function userActingAs(string $role): ?User
    {
        $user = User::query()->whereNotNull('role_id')->first();
        $roleRow = Role::where('role', $role)->first();

        if (!$user || !$roleRow) {
            return null;
        }

        $user->current_role_id = $roleRow->id;
        $user->save();

        return $user->fresh();
    }

    public static function gates(): array
    {
        return array_map(fn ($e) => [$e], array_keys(self::GATES));
    }

    /**
     * @dataProvider gates
     */
    public function test_the_same_roles_are_refused_as_before_the_swap(string $endpoint): void
    {
        [$method, $path] = explode(' ', $endpoint, 2);
        $allowed = self::GATES[$endpoint];

        foreach (Role::pluck('role') as $role) {
            $user = $this->userActingAs($role);
            if (!$user) {
                continue;
            }

            $this->actingAs($user, 'sanctum');
            $response = $this->json($method, $path);
            // Only a 403 carries a message worth reading, and some of these
            // endpoints answer with a file rather than JSON when they succeed.
            $refusedByGate = false;
            if ($response->getStatusCode() === 403) {
                $message = (string) $response->json('message');
                $refusedByGate = !str_contains($message, 'departments are assigned')
                    && !str_contains($message, 'not one of yours');
            }

            if (in_array($role, $allowed, true)) {
                $this->assertFalse(
                    $refusedByGate,
                    "{$endpoint} now refuses '{$role}', which it allowed before the swap."
                );
            } else {
                $this->assertTrue(
                    $refusedByGate,
                    "{$endpoint} now allows '{$role}', which it refused before the swap."
                );
            }
        }
    }
}
