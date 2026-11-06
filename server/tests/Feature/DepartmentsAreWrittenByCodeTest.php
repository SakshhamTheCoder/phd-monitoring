<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use App\Support\DepartmentLabel;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Wherever a department is only displayed it is written by its code, since the
 * full title does not fit a cell; a filter still finds it by name or by code.
 */
class DepartmentsAreWrittenByCodeTest extends TestCase
{
    use DatabaseTransactions;

    public function test_the_label_is_the_code_and_falls_back_to_the_name(): void
    {
        $this->assertSame('CSED', DepartmentLabel::of(new Department(['name' => 'Computer Science and Engineering', 'code' => 'CSED'])));
        $this->assertSame('CSED', DepartmentLabel::of(['name' => 'Computer Science and Engineering', 'code' => 'CSED']));
        $this->assertSame('Mathematics', DepartmentLabel::of(new Department(['name' => 'Mathematics', 'code' => ' '])));
        $this->assertSame('Mathematics', DepartmentLabel::of(['name' => 'Mathematics']));
        $this->assertNull(DepartmentLabel::of(null));
        $this->assertNull(DepartmentLabel::of(['name' => '', 'code' => '']));
    }

    public function test_the_student_table_shows_the_code_and_filters_find_it_by_name_or_code(): void
    {
        $department = Department::create(['name' => 'Department of Wayfinding Studies', 'code' => 'WAYZ' . random_int(100, 999)]);
        $student = Student::firstOrFail();
        $student->department_id = $department->id;
        $student->save();

        $admin = User::whereNotNull('role_id')->firstOrFail();
        $admin->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $admin->save();
        $this->actingAs($admin->fresh(), 'sanctum');

        foreach ([$department->code, 'wayfinding', 'Wayz'] as $typed) {
            $filters = urlencode(json_encode(['combine' => 'or', 'conditions' => [['key' => 'department.name', 'op' => 'LIKE', 'value' => $typed]]]));
            $rows = collect($this->getJson('/api/students?rows=200&filters=' . $filters)->assertOk()->json('data'));
            $mine = $rows->firstWhere('roll_no', $student->roll_no);

            $this->assertNotNull($mine, "typing '{$typed}' should find the scholar");
            $this->assertSame($department->code, $mine['department'], 'the table writes the code, not the title');
            $this->assertTrue($rows->every(fn ($row) => $row['department'] === $department->code), 'only that department is listed');
        }
    }

    private function actAsAdmin(): void
    {
        $admin = User::whereNotNull('role_id')->firstOrFail();
        $admin->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $admin->save();
        $this->actingAs($admin->fresh(), 'sanctum');
    }

    public function test_a_department_picker_shows_the_code_and_searches_the_title(): void
    {
        $department = Department::create(['name' => 'Department of Wayfinding Studies', 'code' => 'WAYP' . random_int(100, 999)]);
        $this->actAsAdmin();

        $view = $this->getJson('/api/views/students')->assertOk()->json();
        $options = [];
        $walk = function ($node) use (&$walk, &$options, $department) {
            if (is_array($node)) {
                if (($node['value'] ?? null) === $department->id && isset($node['title'])) {
                    $options[] = $node;
                }
                foreach ($node as $child) {
                    $walk($child);
                }
            }
        };
        $walk($view);

        $this->assertNotEmpty($options, 'the add-student dialog offers the department');
        $this->assertSame($department->code, $options[0]['title'], 'only the code is shown');
        $this->assertSame($department->name, $options[0]['keywords'], 'the title is searched');

        $suggested = collect($this->postJson('/api/suggestions/department', ['text' => 'wayfinding'])->assertOk()->json())->firstWhere('id', $department->id);
        $this->assertSame($department->code, $suggested['name']);
        $this->assertSame($department->name, $suggested['full_name']);
        $this->assertSame($department->id, collect($this->postJson('/api/suggestions/department', ['text' => $department->code])->json())->firstWhere('id', $department->id)['id']);
    }

    public function test_the_departments_page_shows_the_title_and_the_code(): void
    {
        $department = Department::create(['name' => 'Department of Wayfinding Studies', 'code' => 'WAYD' . random_int(100, 999)]);
        $this->actAsAdmin();

        $answer = $this->getJson('/api/departments?rows=1000')->assertOk();
        $this->assertSame(['name', 'code'], array_slice($answer->json('fields'), 0, 2));
        $this->assertSame(['Name', 'Code'], array_slice($answer->json('fieldsTitles'), 0, 2));
        $row = collect($answer->json('data'))->firstWhere('id', $department->id);
        $this->assertSame([$department->name, $department->code], [$row['name'], $row['code']]);
    }

    public function test_faculty_are_found_by_their_departments_code(): void
    {
        $department = Department::create(['name' => 'Department of Wayfinding Studies', 'code' => 'WAYF' . random_int(100, 999)]);
        $faculty = \App\Models\Faculty::where('type', 'internal')->firstOrFail();
        $faculty->department_id = $department->id;
        $faculty->save();
        $this->actAsAdmin();

        foreach ([$department->code, 'wayfinding'] as $typed) {
            $found = collect($this->postJson('/api/suggestions/faculty', ['text' => $typed])->assertOk()->json());
            $this->assertNotNull($found->firstWhere('id', $faculty->faculty_code), "'{$typed}' should find their faculty");
        }
    }
}
