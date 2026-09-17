<?php

namespace Tests\Feature;

use App\Models\FeatureFlag;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * A project's positions and applicants are recruitment, so they answer to the
 * job_openings switch, not to project_management.
 *
 * Before this they sat under project_management alone, so with openings off a
 * PI could still post a position and list its applicants while
 * POST /applications/{id}/status refused every decision on them. The page
 * half-worked, which is worse than it being gone.
 *
 * The requests are authenticated on purpose: Laravel's middleware priority runs
 * Authenticate ahead of the feature gate, so an anonymous caller gets 401 and
 * never reaches it. That is the right order, but it means the gate can only be
 * observed from behind a login.
 */
class RecruitmentFollowsOpeningsFlagTest extends TestCase
{
    use DatabaseTransactions;

    private const GATE_MESSAGE = 'This feature is currently unavailable.';

    private const RECRUITMENT_ROUTES = [
        ['getJson', '/api/projects/1/positions'],
        ['postJson', '/api/projects/1/positions'],
        ['getJson', '/api/projects/1/applications'],
    ];

    private function faculty(): User
    {
        $roleId = Role::where('role', 'faculty')->value('id')
            ?? DB::table('roles')->insertGetId(['role' => 'faculty', 'created_at' => now(), 'updated_at' => now()]);

        $user = new User();
        $user->forceFill([
            'first_name' => 'Flag',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@flag.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function setFlag(string $key, bool $on): void
    {
        FeatureFlag::query()->updateOrCreate(['key' => $key], ['enabled' => $on]);
    }

    public function test_recruitment_is_absent_while_job_openings_is_off(): void
    {
        $this->setFlag('project_management', true);
        $this->setFlag('job_openings', false);
        $user = $this->faculty();

        foreach (self::RECRUITMENT_ROUTES as [$method, $uri]) {
            // 404, not 403: a disabled module should look absent rather than
            // forbidden, so nothing invites anyone to ask for access to it.
            $this->actingAs($user, 'sanctum')->{$method}($uri)
                ->assertStatus(404)
                ->assertJson(['message' => self::GATE_MESSAGE]);
        }
    }

    public function test_recruitment_is_reachable_while_job_openings_is_on(): void
    {
        $this->setFlag('project_management', true);
        $this->setFlag('job_openings', true);
        $user = $this->faculty();

        foreach (self::RECRUITMENT_ROUTES as [$method, $uri]) {
            // Project 1 does not exist here, so the controller answers 404 too.
            // The gate's own 404 carries a particular message, so that is what
            // distinguishes "switched off" from "no such project".
            $body = $this->actingAs($user, 'sanctum')->{$method}($uri)->json();
            $this->assertNotSame(
                self::GATE_MESSAGE,
                $body['message'] ?? null,
                $uri . ' should be past the feature gate while job_openings is on'
            );
        }
    }

    public function test_project_management_still_gates_the_rest_of_projects(): void
    {
        $this->setFlag('project_management', false);
        $this->setFlag('job_openings', true);
        $user = $this->faculty();

        $this->actingAs($user, 'sanctum')->getJson('/api/projects')->assertStatus(404);
    }
}
