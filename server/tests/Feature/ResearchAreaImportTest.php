<?php

namespace Tests\Feature;

use App\Models\AreaOfSpecialization;
use App\Models\Department;
use App\Models\Role;
use App\Models\Faculty;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The research area matrix import, which seeds the portal's only list of broad
 * areas.
 *
 * The institute's sheet is wide: one column per department code, one area per
 * cell. Loading it is not a one-off, because the same file is re-sent whenever
 * a department revises its list, so the three things worth pinning are that the
 * wide shape is read at all, that a second run of an unchanged file changes
 * nothing, and that an area somebody is already using survives being dropped
 * from the sheet.
 */
class ResearchAreaImportTest extends TestCase
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

    /**
     * The import takes rows, not a file: the shared modal splits the CSV on the
     * client, the same as every other importer. This mirrors what it sends.
     *
     * @param  array<int, string>  $header
     * @param  array<int, array<int, string>>  $rows
     */
    private function upload(array $header, array $rows)
    {
        $payload = [];
        foreach ($rows as $index => $row) {
            $payload[] = array_combine($header, $row) + ['_rowNumber' => $index + 2];
        }

        return $this->postJson('/api/departments/area-of-specialization/import', ['rows' => $payload]);
    }

    private function areaNames(Department $department): array
    {
        return AreaOfSpecialization::where('department_id', $department->id)
            ->orderBy('name')->pluck('name')->all();
    }

    public function test_a_wide_matrix_loads_and_reloading_it_changes_nothing(): void
    {
        $this->admin();
        $department = Department::firstOrFail();
        AreaOfSpecialization::where('department_id', $department->id)->delete();

        $wide = ['S.No', $department->code];

        $this->upload($wide, [['1', 'Machine Learning'], ['2', 'Quantum Computing']])->assertStatus(200);
        $this->assertSame(['Machine Learning', 'Quantum Computing'], $this->areaNames($department));

        // Case and spacing differ far more often than meaning, so a second run
        // of the same list must not add near duplicates of what is already there.
        $this->upload($wide, [['1', 'machine  learning'], ['2', 'Quantum Computing']])
            ->assertStatus(200)
            ->assertJsonPath('imported_count', 0)
            ->assertJsonPath('removed_count', 0);

        $this->assertSame(['Machine Learning', 'Quantum Computing'], $this->areaNames($department));
    }

    public function test_the_institutes_own_matrix_header_loads(): void
    {
        $this->admin();
        $department = Department::firstOrFail();
        AreaOfSpecialization::where('department_id', $department->id)->delete();

        // The Drive sheet verbatim: a label column, then one column per
        // department, and most cells on any given row empty.
        $header = ['Dept Broad areas of research', $department->code, 'NOTADEPT'];

        $response = $this->upload($header, [
            ['1', 'Machine Learning', 'Ignored'],
            ['2', '', 'Ignored'],
            ['3', 'Cyber Security', ''],
        ])->assertStatus(200);

        $this->assertSame(['Cyber Security', 'Machine Learning'], $this->areaNames($department));

        // A column header that is not a department is named back, so a typo in
        // the sheet cannot silently drop a whole department's areas.
        $this->assertSame(['NOTADEPT'], $response->json('ignored_columns'));
    }

    public function test_an_area_in_use_is_kept_when_the_sheet_drops_it(): void
    {
        $this->admin();
        $department = Department::firstOrFail();
        AreaOfSpecialization::where('department_id', $department->id)->delete();

        $wide = ['S.No', $department->code];
        $this->upload($wide, [['1', 'Machine Learning'], ['2', 'Quantum Computing']])->assertStatus(200);

        $inUse = AreaOfSpecialization::where('department_id', $department->id)
            ->where('name', 'Quantum Computing')->firstOrFail();

        // A faculty member listed under an area is what holds it open. What
        // scholars write is their own words and points at nothing.
        $faculty = Faculty::where('department_id', $department->id)->firstOrFail();
        $faculty->area_of_specialization_id = $inUse->id;
        $faculty->save();

        $response = $this->upload($wide, [['1', 'Machine Learning']])->assertStatus(200);

        $this->assertSame(['Machine Learning', 'Quantum Computing'], $this->areaNames($department));
        $this->assertSame(
            [$department->code . ': Quantum Computing'],
            $response->json('kept_in_use')
        );
    }
}
