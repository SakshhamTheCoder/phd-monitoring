<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The areas import asks before it writes, naming the departments the sheet
 * replaces, and answers with what the page tells the reader.
 */
class AreaImportTellsTheReaderTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::where('email', 'admin@fixture.test')->first();
        if (!$user) {
            $this->markTestSkipped('No admin@fixture.test account. Seed TestFixturesSeeder.');
        }
        return $user;
    }

    public function test_the_preview_names_the_departments_and_writes_nothing(): void
    {
        $this->actingAs($this->admin());
        $before = \App\Models\AreaOfSpecialization::count();

        $template = [['_rowNumber' => 2, 'name' => 'Quantum Sensing', 'department_code' => 'CSED'], ['_rowNumber' => 3, 'name' => 'Graphs', 'department_code' => ' CSED ']];
        $this->postJson('/api/departments/area-of-specialization/import', ['rows' => $template, 'preview' => true])
            ->assertOk()
            ->assertJsonPath('confirm', 'Importing replaces the research areas of CSED. Any area of theirs that is not in the sheet is deleted, unless a scholar or faculty member uses it. Continue?');

        $matrix = [['_rowNumber' => 2, 'Area' => '1', 'CSED' => 'Graphs', 'CHED' => 'Catalysis']];
        $this->postJson('/api/departments/area-of-specialization/import', ['rows' => $matrix, 'preview' => true])
            ->assertJsonPath('confirm', 'Importing replaces the research areas of CSED, CHED. Any area of theirs that is not in the sheet is deleted, unless a scholar or faculty member uses it. Continue?');

        $this->assertSame($before, \App\Models\AreaOfSpecialization::count());
    }

    public function test_the_answer_says_what_happened_in_the_page_s_words(): void
    {
        $this->actingAs($this->admin());
        $rows = [['_rowNumber' => 2, 'name' => '', 'department_code' => 'NOPE']];

        $messages = $this->postJson('/api/departments/area-of-specialization/import', ['rows' => $rows])->assertOk()->json('messages');

        $this->assertSame(['tone' => 'success', 'text' => '0 areas added, 0 unused areas removed'], $messages[0]);
        $this->assertSame(['tone' => 'warn', 'text' => 'Row 2: no area name'], $messages[1]);
    }
}
