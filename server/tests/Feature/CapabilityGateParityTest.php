<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class CapabilityGateParityTest extends TestCase
{
    use DatabaseTransactions;

    /** endpoint => the roles the code admitted before the swap. */
    private const GATES = [
        'GET /api/users' => ['admin'],
        'GET /api/faculty' => ['admin', 'director', 'dra', 'dordc', 'hod', 'phd_coordinator', 'adordc', 'faculty', 'doctoral', 'external', 'student'],
        'GET /api/students' => ['admin', 'director', 'dra', 'dordc', 'hod', 'phd_coordinator', 'adordc', 'faculty', 'doctoral', 'external', 'student'],
        'GET /api/clerks/my-departments' => ['clerk'],
        'GET /api/clerks/attendance' => ['clerk', 'admin'],
        'GET /api/clerks/attendance/history' => ['clerk', 'admin'],
        'GET /api/clerks/attendance/template' => ['clerk', 'admin'],
        'GET /api/settings/leave' => ['admin', 'clerk', 'hod', 'student'],

        // Empty bodies are fine here, the capability check runs before validation, so admitted roles get 422 not 403.
        'POST /api/admin/forms/create' => ['admin'],
        'POST /api/admin/forms/disable' => ['admin'],
        'POST /api/outside-experts/add' => ['admin'],
        'GET /api/outside-experts/list' => ['admin', 'hod', 'phd_coordinator', 'doctoral', 'dordc'],
        'POST /api/courses/add' => ['hod', 'phd_coordinator', 'admin'],
        'GET /api/patents' => ['student'],
        'GET /api/users/filters' => ['admin'],
    ];

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
