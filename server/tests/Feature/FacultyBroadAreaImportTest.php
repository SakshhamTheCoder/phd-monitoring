<?php

namespace Tests\Feature;

use App\Models\AreaOfSpecialization;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use App\Support\SupervisionCapacity;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The two columns the institute's supervisor sheet adds to the faculty import.
 *
 * A broad area has to be one the department already offers, because the same
 * list feeds the scholar's allocation form and the recommender; a typo that
 * quietly created a new area would put a one-off spelling in front of every
 * scholar in the department. The outside count is the opposite case: nothing
 * but the supervisor can know it, and it has to reach the supervision limit,
 * or someone already at capacity elsewhere looks free here.
 */
class FacultyBroadAreaImportTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    private function row(Faculty $faculty, array $overrides = []): array
    {
        return array_merge([
            'full_name' => '',
            'email' => $faculty->user->email,
            'phone' => '',
            'designation' => '',
            'faculty_code' => '',
            'department_code' => '',
            'institution' => '',
            'website_link' => '',
            'expertise' => '',
            'broad_area' => '',
            'supervised_campus' => '',
            'supervised_outside' => '',
            'row_number' => 2,
        ], $overrides);
    }

    private function import(array $row)
    {
        return $this->postJson('/api/faculty/bulk-import', ['batch_data' => [$row]]);
    }

    private function internalFaculty(): Faculty
    {
        return Faculty::with('user')->whereNotNull('department_id')->where('type', 'internal')->firstOrFail();
    }

    public function test_a_broad_area_off_the_department_list_is_refused(): void
    {
        $this->admin();
        $faculty = $this->internalFaculty();

        $response = $this->import($this->row($faculty, ['broad_area' => 'Sorcery']))->assertStatus(200);

        $this->assertStringContainsString('is not a research area', $response->json('data.errors.0'));
        $this->assertNull($faculty->fresh()->area_of_specialization_id);
    }

    public function test_a_listed_broad_area_is_stored_and_the_outside_count_uses_a_slot(): void
    {
        $this->admin();
        $faculty = $this->internalFaculty();

        $area = AreaOfSpecialization::create([
            'department_id' => $faculty->department_id,
            'name' => 'Rocket Surgery',
        ]);

        $before = SupervisionCapacity::currentLoad($faculty);

        // Spelled differently from the stored name: a sheet is typed by hand and
        // case is not what makes two areas different.
        $this->import($this->row($faculty, [
            'broad_area' => '  rocket surgery ',
            'supervised_outside' => '2',
        ]))->assertStatus(200)->assertJsonPath('data.errors', []);

        $faculty = $faculty->fresh();

        $this->assertSame($area->id, $faculty->area_of_specialization_id);
        $this->assertSame(2, (int) $faculty->supervised_outside);
        $this->assertSame($before + 2, SupervisionCapacity::currentLoad($faculty));
        $this->assertSame(
            SupervisionCapacity::currentLoad($faculty),
            SupervisionCapacity::loadsFor([$faculty->faculty_code])[$faculty->faculty_code] ?? 0
        );
    }

    public function test_a_wrong_in_tiet_count_is_reported_without_being_stored(): void
    {
        $this->admin();
        $faculty = $this->internalFaculty();

        $response = $this->import($this->row($faculty, [
            'supervised_campus' => (string) ($faculty->supervised_campus + 5),
        ]))->assertStatus(200);

        $this->assertStringContainsString('the portal has', $response->json('data.errors.0'));
    }
}
