<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * GET /views/{page} describes a page for the reader: only a reader the page is
 * for gets it, and a page the server does not describe is not found.
 */
class PageViewsTest extends TestCase
{
    use DatabaseTransactions;

    private function account(string $role): User
    {
        $user = User::where('email', "{$role}@fixture.test")->first();
        if (!$user) {
            $this->markTestSkipped("No {$role}@fixture.test account. Seed TestFixturesSeeder.");
        }
        return $user;
    }

    public function test_a_page_is_described_for_the_reader_it_is_for(): void
    {
        $this->actingAs($this->account('admin'))->getJson('/api/views/outside-experts')
            ->assertOk()
            ->assertJsonPath('title', 'Outside experts')
            ->assertJsonPath('table.endpoint', '/outside-experts/list')
            ->assertJsonPath('dialogs.edit.request.path', '/outside-experts/update/{id}')
            ->assertJsonPath('dialogs.add.rows.0.items.0.key', 'full_name');
    }

    public function test_a_reader_the_page_is_not_for_is_refused(): void
    {
        $this->actingAs($this->account('student'))->getJson('/api/views/outside-experts')->assertForbidden();
    }

    public function test_an_unknown_page_is_not_found(): void
    {
        $this->actingAs($this->account('admin'))->getJson('/api/views/no-such-page')->assertNotFound();
    }

    public function test_course_management_offers_what_each_reader_may_do(): void
    {
        $admin = $this->actingAs($this->account('admin'))->getJson('/api/views/courses')->assertOk();
        $this->assertSame(['Tag student', 'Import from CSV', 'Add course'], array_column($admin->json('actions'), 'label'));
        // Only admin picks the department; the others post it empty for the server to fill.
        $this->assertSame('select', $admin->json('dialogs.add.rows.0.rows.3.type'));

        $hod = $this->actingAs($this->account('hod'))->getJson('/api/views/courses')->assertOk();
        $this->assertSame('hidden', $hod->json('dialogs.add.rows.0.rows.3.type'));
        $this->assertNotNull($hod->json('dialogs.tag'));

        $this->actingAs($this->account('student'))->getJson('/api/views/courses')->assertForbidden();
    }

    public function test_the_coursework_import_answers_in_the_page_s_words(): void
    {
        $this->actingAs($this->account('admin'));
        $rows = [['_rowNumber' => 2, 'Registration Number' => '', 'Academic Year' => '2425ODD', 'Subject Code' => 'PCS101']];

        $messages = $this->postJson('/api/courses/student/bulk-import', ['rows' => $rows])->assertOk()->json('messages');

        $this->assertSame(['tone' => 'success', 'text' => '0 enrolments imported'], $messages[0]);
        $this->assertStringStartsWith('Row 2', $messages[1]['text']);
    }

    public function test_the_progress_list_offers_each_role_its_own_tabs(): void
    {
        $values = fn (string $role) => array_column($this->actingAs($this->account($role))->getJson('/api/views/presentation-list')->assertOk()->json('tabs') ?? [], 'value');

        // Admin reviews nothing, so no Action required, and opens on All.
        $this->assertSame([1, 2, 3, 5, 6], $values('admin'));
        $this->assertSame([0, 1, 2, 3, 5, 6], $values('hod'));
        // Not scheduled is read by the roles the server answers it for.
        $this->assertSame([0, 1, 2, 5, 6], $values('dra'));
        // A scholar sees only their own, without tabs.
        $this->assertSame([], $values('student'));
    }

    public function test_a_form_list_is_named_and_offers_what_the_reader_raises(): void
    {
        $view = fn (string $role, array $params) => $this->actingAs($this->account($role))
            ->getJson('/api/views/form-list?' . http_build_query($params))->assertOk();

        $this->assertSame('IRB submission', $view('admin', ['form_type' => 'irb-submission'])->json('title'));
        $this->assertSame('Create new form', $view('student', ['form_type' => 'irb-submission'])->json('actions.0.label'));
        $this->assertSame('form-cards', $view('student', ['form_type' => 'irb-submission'])->json('content.block'));
        $this->assertSame('Raise supervisor change', $view('phd_coordinator', ['form_type' => 'supervisor-change', 'roll_no' => '1'])->json('actions.0.label'));
        $this->assertSame([], $view('hod', ['form_type' => 'supervisor-change', 'roll_no' => '1'])->json('actions'));
        $this->assertSame('Bulk allocate', $view('phd_coordinator', ['form_type' => 'supervisor-allocation'])->json('table.toolbar.0.label'));
    }

    public function test_configuration_describes_each_settings_group(): void
    {
        $sections = $this->actingAs($this->account('admin'))->getJson('/api/views/configuration')->assertOk()->json('sections');

        $this->assertSame(['leave', 'thesis', 'supervision', 'branches', 'coursework', 'checklist'], array_column($sections, 'value'));
        $this->assertSame('Leave quota settings saved', $sections[0]['section']['done']);
        $this->actingAs($this->account('student'))->getJson('/api/views/configuration')->assertForbidden();
    }

    public function test_the_urf_page_offers_the_office_its_switch(): void
    {
        $actions = $this->actingAs($this->account('admin'))->getJson('/api/views/urf')->assertOk()->json('actions');
        $this->assertSame('Import awarded', $actions[0]['label']);
        $this->assertSame('/settings/urf', $actions[1]['request']['path']);
    }
}
