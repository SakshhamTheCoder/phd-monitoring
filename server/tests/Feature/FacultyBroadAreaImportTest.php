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

    /**
     * An area nobody offers is still not stored, but the person is.
     *
     * Refusing the whole row used to lose them over a wording difference
     * between two sheets, and they work here whatever the matrix says.
     */
    public function test_a_broad_area_off_the_department_list_is_reported_and_the_row_still_lands(): void
    {
        $this->admin();
        $faculty = $this->internalFaculty();

        $response = $this->import($this->row($faculty, [
            'broad_area' => 'Sorcery',
            'designation' => 'Sorcerer Supreme',
        ]))->assertStatus(200);

        $this->assertStringContainsString('is not a research area', $response->json('data.errors.0'));
        $this->assertSame(0, $response->json('data.error_count'), 'the person is not lost over the wording');
        $this->assertNull($faculty->fresh()->area_of_specialization_id);
        $this->assertSame('Sorcerer Supreme', $faculty->fresh()->designation);
    }

    /**
     * The institute's two sheets write the same area differently.
     *
     * The faculty sheet names every area a person works on in one cell, and
     * the area matrix stores whole lists as single areas for some departments.
     * Matched whole against whole, almost no row of the real sheet matched.
     */
    public function test_an_area_named_among_others_on_either_side_is_found(): void
    {
        $this->admin();
        $faculty = $this->internalFaculty();

        $area = AreaOfSpecialization::create([
            'department_id' => $faculty->department_id,
            'name' => 'VLSI Design, Low power system design and test, FPGA-based designs',
        ]);

        $this->import($this->row($faculty, [
            'broad_area' => 'Wireless Communication; vlsi design, Computer Vision',
        ]))->assertStatus(200);

        $this->assertSame($area->id, $faculty->fresh()->area_of_specialization_id);
    }

    /**
     * Sheets leave a phone as #N/A or blank, and users.phone is unique.
     *
     * Stored as an empty string, the first such row took '' and every row
     * after it died on a duplicate key: 47 rows of the institute's own file.
     */
    public function test_a_blank_phone_is_stored_as_nothing(): void
    {
        $this->admin();

        $rows = [];
        foreach ([1, 2] as $i) {
            $rows[] = array_merge($this->row($this->internalFaculty()), [
                'full_name' => "Phoneless Person {$i}",
                'email' => "phoneless.person{$i}@thapar.test",
                'phone' => $i === 1 ? '' : '#N/A',
                'designation' => 'Professor',
                'faculty_code' => (string) (994100 + $i),
                'department_code' => $this->internalFaculty()->department->code,
                'row_number' => $i + 1,
            ]);
        }

        $response = $this->postJson('/api/faculty/bulk-import', ['batch_data' => $rows])->assertStatus(200);

        $this->assertSame(0, $response->json('data.error_count'), json_encode($response->json('data.errors')));
        foreach ([1, 2] as $i) {
            $this->assertNull(User::where('email', "phoneless.person{$i}@thapar.test")->firstOrFail()->phone);
        }
    }

    /**
     * A staff list is a migration of records, so nobody is mailed by it.
     *
     * The link lives 24 hours. Importing the institute's 568 row sheet used to
     * mail one to every person it created, before anybody had been told the
     * portal existed.
     */
    public function test_the_import_mails_nobody_unless_asked(): void
    {
        \Illuminate\Support\Facades\Notification::fake();
        $this->admin();
        $department = $this->internalFaculty()->department;

        $this->import($this->row($this->internalFaculty(), [
            'full_name' => 'Quiet Arrival',
            'email' => 'quiet.arrival@thapar.test',
            'designation' => 'Professor',
            'department_code' => $department->code,
            'faculty_code' => '994205',
        ]))->assertStatus(200);

        \Illuminate\Support\Facades\Notification::assertNothingSent();
        $this->assertNotNull(User::where('email', 'quiet.arrival@thapar.test')->first());
    }

    /** An employee code somebody else holds is a person question, not a crash. */
    public function test_an_employee_code_another_person_holds_is_reported(): void
    {
        $this->admin();
        $holder = $this->internalFaculty();

        $response = $this->import($this->row($holder, [
            'full_name' => 'Somebody Else',
            'email' => 'somebody.else@thapar.test',
            'designation' => 'Professor',
            'department_code' => $holder->department->code,
            'faculty_code' => (string) $holder->faculty_code,
        ]))->assertStatus(200);

        $this->assertStringContainsString('already belongs to', $response->json('data.errors.0'));
        $this->assertNull(User::where('email', 'somebody.else@thapar.test')->first());
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
