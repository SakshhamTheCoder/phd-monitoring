<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\Semester;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The semester page opens on "Action Required", which filters on the acting
 * role's lock column. Admin has no column there and got a 500.
 */
class ProgressMonitoringRoleListsTest extends TestCase
{
    use DatabaseTransactions;

    private function semesterCode(): string
    {
        $semester = Semester::orderByDesc('start_date')->first();
        if (!$semester) {
            $this->markTestSkipped('No semester in this database.');
        }
        return $semester->semester_name;
    }

    private function actingAsRole(string $role, ?User $user = null): User
    {
        $user ??= User::query()->whereHas('faculty')->first() ?? User::query()->first();
        $user->current_role_id = Role::where('role', $role)->value('id');
        $user->save();
        $this->actingAs($user = $user->fresh());
        return $user;
    }

    private function actionRequired(string $semester)
    {
        $filters = urlencode(json_encode(['mandatory_filter' => [['key' => 'action', 'value' => 1]]]));
        return $this->getJson("/api/presentation/semester/{$semester}?page=1&rows=50&filters={$filters}");
    }

    public function test_admin_action_required_is_empty_rather_than_an_error(): void
    {
        $semester = $this->semesterCode();
        $this->actingAsRole('admin');

        $this->actionRequired($semester)->assertOk()->assertJsonPath('total', 0);
    }

    public function test_every_reviewing_role_can_open_action_required(): void
    {
        $semester = $this->semesterCode();

        foreach (['faculty', 'hod', 'phd_coordinator', 'adordc', 'dordc', 'dra', 'director'] as $role) {
            $this->actingAsRole($role);
            $this->assertSame(200, $this->actionRequired($semester)->status(), "{$role} could not open Action Required");
        }
    }

    public function test_semester_pages_answer_for_the_role_being_acted_as_not_the_account_role(): void
    {
        $semester = $this->semesterCode();
        $user = User::query()->whereHas('faculty')->first();
        if (!$user) {
            $this->markTestSkipped('No faculty account in this database.');
        }
        $user->role_id = Role::where('role', 'faculty')->value('id');
        $this->actingAsRole('admin', $user);

        $response = $this->getJson("/api/presentation/semester/{$semester}/not-scheduled?page=1&rows=50");

        $response->assertOk();
        $this->assertNotSame('supervised', $response->json('type'));
    }
}
