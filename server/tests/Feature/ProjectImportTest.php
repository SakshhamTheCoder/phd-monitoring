<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Project;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Projects from the office's sheet: one row per project, the PI found by email.
 *
 * The rows are posted as the browser posts them, under the template's own
 * headers, so the reading of "Category (In-house, ...)" as category is part of
 * what is under test. A bad row is named and left out; it never stops the file.
 */
class ProjectImportTest extends TestCase
{
    use DatabaseTransactions;

    private function actAs(string $role): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    /** @return array<int, Faculty> */
    private function people(int $count): array
    {
        $people = Faculty::where('type', 'internal')->with('user')->get()
            ->filter(fn ($faculty) => $faculty->user && $faculty->user->email && $faculty->user->first_name)
            ->values();
        if ($people->count() < $count) {
            $this->markTestSkipped('Not enough internal faculty with accounts.');
        }

        return $people->take($count)->all();
    }

    /** One row as the template's headers carry it. */
    private function sheet(int $line, array $cells = []): array
    {
        return array_merge([
            '_rowNumber' => $line,
            'Project Title' => 'Import test ' . $line . ' ' . self::class,
            'PI Name' => '',
            'PI Email' => '',
            'Category (In-house, Research, Consultancy, Industry, International, Other)' => 'Research',
            'Status (Pending, Active, On Hold, Completed)' => '',
            'Funding Agency' => 'DST',
            'Sanctioned Amount (Rs)' => '4850000',
            'TIET Share (Rs, optional)' => '',
            'Start Date (DD-MM-YYYY)' => '01-04-2025',
            'Duration Years (0-5)' => '3',
            'Duration Months (0-11)' => '',
            'Focus Area (optional)' => 'Energy',
            'Grant Type (optional)' => 'CRG',
            'Co-PI 1 Name (optional)' => '',
            'Co-PI 1 Email' => '',
            'Co-PI 2 Name' => '',
            'Co-PI 2 Email' => '',
            'Co-PI 3 Name' => '',
            'Co-PI 3 Email' => '',
            'Description (optional)' => 'Short abstract',
            'Objective 1 (optional)' => 'Build X',
            'Objective 2' => '',
            'Objective 3' => '',
            'Objective 4' => '',
            'Objective 5' => '',
            'SDGs (optional, numbers 1-17 comma separated)' => '7, 9',
            'Sanction Letter Link (optional)' => 'https://example.org/letter.pdf',
        ], $cells);
    }

    private function import(array $rows)
    {
        return $this->postJson('/api/projects/import', ['rows' => $rows]);
    }

    private function stored(int $line): ?Project
    {
        return Project::where('title', 'Import test ' . $line . ' ' . self::class)->first();
    }

    public function test_the_office_adds_projects_from_the_sheet(): void
    {
        [$first, $second] = $this->people(2);
        $this->actAs('admin');

        $this->import([
            $this->sheet(2, ['PI Email' => $first->user->email, 'TIET Share (Rs, optional)' => '1,000,000']),
            $this->sheet(3, ['PI Email' => strtoupper($second->user->email), 'Status (Pending, Active, On Hold, Completed)' => 'on hold',
                'Duration Years (0-5)' => '0', 'Duration Months (0-11)' => '8', 'Sanctioned Amount (Rs)' => '₹48,50,000', 'TIET Share (Rs, optional)' => '']),
        ])->assertOk()
            ->assertJsonPath('data.success_count', 2)
            ->assertJsonPath('data.update_count', 0)
            ->assertJsonPath('data.skipped_count', 0)
            ->assertJsonPath('messages.0.tone', 'success');

        $one = $this->stored(2);
        $this->assertSame($first->faculty_code, (int) $one->pi_faculty_code);
        $this->assertSame('PI', $one->role);
        $this->assertSame('Pending', $one->status);
        $this->assertSame('2025-04-01', (string) $one->start_date);
        $this->assertSame('2028-04-01', (string) $one->end_date);
        $this->assertSame(4850000, $one->amount);
        $this->assertSame(1000000, $one->tiet_share);
        $this->assertSame([7, 9], $one->sdgs);
        $this->assertSame(['Build X'], $one->objectives);
        $this->assertSame('Sanction Letter', $one->sanction_letter_name);

        $two = $this->stored(3);
        $this->assertSame($second->faculty_code, (int) $two->pi_faculty_code);
        $this->assertSame('On Hold', $two->status);
        $this->assertSame('2025-12-01', (string) $two->end_date);
        $this->assertSame(4850000, $two->amount);
        $this->assertNull($two->tiet_share, 'a blank share is not known, which 0 would misstate');
    }

    public function test_sending_the_same_file_again_adds_nothing(): void
    {
        [$pi] = $this->people(1);
        $this->actAs('dordc');
        $rows = [$this->sheet(2, ['PI Email' => $pi->user->email])];

        $this->import($rows)->assertOk()->assertJsonPath('data.success_count', 1);
        $before = Project::count();

        $this->import($rows)->assertOk()
            ->assertJsonPath('data.success_count', 0)
            ->assertJsonPath('data.update_count', 1);
        $this->assertSame($before, Project::count());

        // A row that leaves a cell blank leaves what is stored alone.
        $this->import([$this->sheet(2, ['PI Email' => $pi->user->email, 'Funding Agency' => '', 'Focus Area (optional)' => 'Grids'])])
            ->assertOk()->assertJsonPath('data.update_count', 1);
        $project = $this->stored(2)->fresh();
        $this->assertSame('DST', $project->funding_agency);
        $this->assertSame('Grids', $project->focus_area);
    }

    public function test_an_unknown_pi_names_the_row_and_the_rest_still_import(): void
    {
        [$pi] = $this->people(1);
        $this->actAs('admin');

        $this->import([
            $this->sheet(2, ['PI Email' => 'nobody@nowhere.invalid']),
            $this->sheet(3, ['PI Email' => $pi->user->email]),
        ])->assertOk()
            ->assertJsonPath('data.success_count', 1)
            ->assertJsonPath('data.skipped_count', 1)
            ->assertJsonPath('data.errors.0', 'Row 2: no internal faculty member has the email nobody@nowhere.invalid.');

        $this->assertNull($this->stored(2));
        $this->assertNotNull($this->stored(3));
    }

    public function test_a_bad_cell_names_the_row_and_the_value(): void
    {
        [$pi] = $this->people(1);
        $this->actAs('admin');
        $email = $pi->user->email;

        $response = $this->import([
            $this->sheet(2, ['PI Email' => $email, 'Category (In-house, Research, Consultancy, Industry, International, Other)' => 'Grant']),
            $this->sheet(3, ['PI Email' => $email, 'Sanctioned Amount (Rs)' => 'lots']),
            $this->sheet(4, ['PI Email' => $email, 'Sanctioned Amount (Rs)' => '-5']),
            $this->sheet(5, ['PI Email' => $email, 'Start Date (DD-MM-YYYY)' => '31-02-2025']),
            $this->sheet(6, ['PI Email' => $email, 'Duration Years (0-5)' => '9']),
            $this->sheet(7, ['PI Email' => $email, 'Duration Years (0-5)' => '0', 'Duration Months (0-11)' => '']),
            $this->sheet(8, ['PI Email' => $email, 'SDGs (optional, numbers 1-17 comma separated)' => '7, 30']),
            $this->sheet(9, ['PI Email' => $email, 'Sanction Letter Link (optional)' => 'ftp://x']),
            $this->sheet(10, ['PI Email' => $email, 'Funding Agency' => '']),
            $this->sheet(11, ['PI Email' => $email]),
        ])->assertOk();

        $response->assertJsonPath('data.success_count', 1)->assertJsonPath('data.skipped_count', 9);
        $errors = $response->json('data.errors');
        foreach ([2 => "Category 'Grant'", 3 => "Sanctioned Amount 'lots'", 4 => "Sanctioned Amount '-5'", 5 => "Start Date '31-02-2025'",
            6 => "Duration Years '9'", 7 => 'duration is needed', 8 => "SDG '30'", 9 => 'http://', 10 => 'Funding Agency'] as $line => $says) {
            $found = collect($errors)->first(fn ($error) => str_starts_with($error, "Row {$line}:"));
            $this->assertNotNull($found, "row {$line} should be named");
            $this->assertStringContainsString($says, $found);
        }
        $this->assertNotNull($this->stored(11));
    }

    public function test_co_pis_are_found_by_email_or_kept_as_outsiders(): void
    {
        [$pi, $colleague] = $this->people(2);
        $this->actAs('admin');

        $response = $this->import([$this->sheet(2, [
            'PI Email' => $pi->user->email,
            'Co-PI 1 Name (optional)' => 'Whoever',
            'Co-PI 1 Email' => $colleague->user->email,
            'Co-PI 2 Name' => 'Prof. R. Miller',
            'Co-PI 2 Email' => 'r.miller@mit.invalid',
            'Co-PI 3 Name' => 'The PI again',
            'Co-PI 3 Email' => $pi->user->email,
        ])])->assertOk()->assertJsonPath('data.success_count', 1);

        $this->assertSame(2, $response->json('data.warning_count'));
        $project = $this->stored(2);
        $this->assertSame([$colleague->faculty_code], $project->coPiFaculty()->pluck('faculty.faculty_code')->map(fn ($c) => (int) $c)->all());

        $people = collect($project->co_pis);
        $this->assertSame('internal', $people[0]['type']);
        $this->assertSame($colleague->user->name(), $people[0]['name'], 'the portal names them, not the sheet');
        $this->assertSame(['external', 'Prof. R. Miller', 'r.miller@mit.invalid'], [$people[1]['type'], $people[1]['name'], $people[1]['email']]);
        $this->assertCount(2, $people);

        // Again: the same people are not added twice.
        $this->import([$this->sheet(2, ['PI Email' => $pi->user->email, 'Co-PI 1 Email' => $colleague->user->email, 'Co-PI 2 Name' => 'Prof. R. Miller', 'Co-PI 2 Email' => 'r.miller@mit.invalid'])])->assertOk();
        $this->assertCount(2, $this->stored(2)->fresh()->co_pis);
    }

    public function test_only_the_office_may_import(): void
    {
        [$pi] = $this->people(1);
        $this->actAs('faculty');

        $this->import([$this->sheet(2, ['PI Email' => $pi->user->email])])
            ->assertStatus(403)
            ->assertJsonPath('message', 'You do not have permission to import projects');
        $this->assertNull($this->stored(2));
    }

    public function test_the_page_offers_the_import_to_the_office_only(): void
    {
        $this->actAs('admin');
        $view = $this->getJson('/api/views/projects')->assertOk();
        $view->assertJsonPath('imports.import.path', '/projects/import');
        $this->assertContains('Import projects', array_column($view->json('actions'), 'label'));

        $this->actAs('faculty');
        $view = $this->getJson('/api/views/projects')->assertOk();
        $this->assertEmpty($view->json('imports'));
        $this->assertNotContains('Import projects', array_column($view->json('actions'), 'label'));
    }

    public function test_messy_cells_are_read_as_a_person_would_read_them(): void
    {
        [$pi] = $this->people(1);
        $this->actAs('admin');
        $messy = " \u{00A0}" . strtoupper($pi->user->email) . ",\u{200B}";

        $this->import([
            $this->sheet(2, [
                'Project Title' => "Import test 2 " . self::class . "\n",
                'PI Email' => $messy,
                'Status (Pending, Active, On Hold, Completed)' => 'On-hold',
                'Category (In-house, Research, Consultancy, Industry, International, Other)' => 'in house',
                'Sanctioned Amount (Rs)' => 'Rs. 5,07,000/-',
                'Start Date (DD-MM-YYYY)' => '6.3.2025',
                'Duration Years (0-5)' => '1.0',
            ]),
            // The same project, its title broken over two lines in the file.
            $this->sheet(3, ['Project Title' => "Import test 2\n" . self::class, 'PI Email' => $pi->user->email, 'Start Date (DD-MM-YYYY)' => '45722',
                'Category (In-house, Research, Consultancy, Industry, International, Other)' => '', 'Sanctioned Amount (Rs)' => '', 'Duration Years (0-5)' => '']),
        ])->assertOk()->assertJsonPath('data.success_count', 1)->assertJsonPath('data.update_count', 1);

        $project = $this->stored(2);
        $this->assertSame('On Hold', $project->status);
        $this->assertSame('In-house', $project->category);
        $this->assertSame(507000, $project->amount);
        $this->assertSame('2025-03-06', (string) $project->start_date, 'an Excel serial for the same day is the same project');
        $this->assertSame('2026-03-06', (string) $project->end_date);
    }

    public function test_a_row_with_no_pi_email_is_named_and_skipped(): void
    {
        $this->actAs('admin');
        $this->import([$this->sheet(2, ['PI Name' => 'Dr. Arpit Goyal'])])->assertOk()
            ->assertJsonPath('data.skipped_count', 1)
            ->assertJsonPath('data.errors.0', "Row 2: PI Email is needed for 'Import test 2 " . self::class . "'.");
    }
}
