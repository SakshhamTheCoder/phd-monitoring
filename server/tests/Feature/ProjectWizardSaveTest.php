<?php

namespace Tests\Feature;

use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The wizard's one-request save writes what the browser's sequence of
 * requests used to write: the project, its milestones in order, the
 * sanction letter link and the Gantt chart. A part that is refused now
 * leaves nothing behind rather than half a project.
 */
class ProjectWizardSaveTest extends TestCase
{
    use DatabaseTransactions;

    private function pi(): User
    {
        $user = User::where('email', 'supervisor@fixture.test')->first();
        if (!$user) {
            $this->markTestSkipped('No supervisor@fixture.test. Seed TestFixturesSeeder.');
        }
        return $user;
    }

    /** The wizard's values, as the web form holds them. */
    private function values(array $overrides = []): array
    {
        return array_merge([
            'title' => 'Low power sensing', 'category' => 'Research', 'status' => 'Active', 'role' => 'PI',
            'focusArea' => 'IoT', 'grantType' => 'CRG', 'fundingAgency' => 'DST', 'description' => 'Sensors that sip power.',
            'startDate' => '2026-10-01', 'durationYears' => '2', 'durationMonths' => 3, 'endDate' => '2029-01-01',
            'sdgs' => [7, 9],
            'coPIs' => [['type' => 'external', 'name' => 'Prof. Robert Miller', 'institute' => 'MIT', 'designation' => '', 'email' => '', 'mobile' => '', 'website' => '']],
            'sanctionAmount' => '4850000', 'tietShare' => '120000', 'sanctionLetterLink' => 'https://example.invalid/letter.pdf',
            'sanctionLetterFile' => null, 'sanctionLetterFileName' => '', 'ganttFile' => null, 'ganttFileName' => '',
            'budget' => ['year1' => ['Consumables' => 5000], 'year2' => []],
            'objectives' => ['Build it', ' '],
            'milestones' => [
                ['name' => 'Prototype', 'deliverable' => 'Demo', 'dueDate' => '2027-01-01', 'status' => 'Completed'],
                ['name' => '', 'deliverable' => '', 'dueDate' => '', 'status' => 'Not Started'],
                ['name' => 'Field trial', 'deliverable' => 'Report', 'dueDate' => '', 'status' => 'Not Started'],
            ],
        ], $overrides);
    }

    /** What the browser used to send, request by request (api/projects.js). */
    private function saveTheOldWay(User $pi, array $values): int
    {
        $id = $this->actingAs($pi)->postJson('/api/projects', [
            'title' => $values['title'], 'category' => $values['category'], 'status' => $values['status'], 'role' => $values['role'],
            'focus_area' => $values['focusArea'], 'grant_type' => $values['grantType'], 'funding_agency' => $values['fundingAgency'],
            'description' => $values['description'], 'start_date' => $values['startDate'], 'end_date' => $values['endDate'],
            'duration_years' => (int) $values['durationYears'], 'duration_months' => (int) $values['durationMonths'],
            'amount' => (int) $values['sanctionAmount'], 'tiet_share' => (int) $values['tietShare'],
            'co_pis' => $values['coPIs'], 'sdgs' => $values['sdgs'], 'objectives' => ['Build it'], 'budget' => $values['budget'],
        ])->assertCreated()->json('id');
        foreach (array_filter($values['milestones'], fn ($m) => $m['name'] !== '') as $m) {
            $this->actingAs($pi)->postJson("/api/projects/{$id}/milestones", ['name' => $m['name'], 'deliverable' => $m['deliverable'], 'due_date' => $m['dueDate'] ?: null, 'status' => $m['status']])->assertCreated();
        }
        $this->actingAs($pi)->postJson("/api/projects/{$id}", ['sanction_letter_link' => $values['sanctionLetterLink'], 'sanction_letter_name' => 'Sanction Letter'])->assertOk();
        return $id;
    }

    private function saved(int $id): array
    {
        $project = Project::findOrFail($id)->makeHidden(['id', 'gantt_chart_path'])->toArray();
        $milestones = ProjectMilestone::where('project_id', $id)->orderBy('id')->get(['name', 'deliverable', 'due_date', 'status'])->toArray();
        return [$project, $milestones];
    }

    public function test_one_request_saves_what_the_sequence_saved(): void
    {
        Storage::fake('local');
        $pi = $this->pi();
        $old = $this->saveTheOldWay($pi, $this->values());

        $new = $this->actingAs($pi)->post('/api/projects/wizard', [
            'values' => json_encode($this->values()),
            'gantt_chart' => UploadedFile::fake()->create('plan.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated()->assertJsonPath('message', 'Project created.')->json('id');

        [$oldProject, $oldMilestones] = $this->saved($old);
        [$newProject, $newMilestones] = $this->saved($new);
        $this->assertSame('plan.pdf', $newProject['gantt_chart_name']);
        unset($newProject['gantt_chart_name'], $oldProject['gantt_chart_name']);
        $this->assertEquals($oldProject, $newProject);
        $this->assertEquals($oldMilestones, $newMilestones);
    }

    public function test_an_edit_brings_the_milestones_in_line(): void
    {
        Storage::fake('local');
        $pi = $this->pi();
        $id = $this->actingAs($pi)->post('/api/projects/wizard', ['values' => json_encode($this->values())], ['Accept' => 'application/json'])->assertCreated()->json('id');
        $stored = ProjectMilestone::where('project_id', $id)->orderBy('id')->get();

        // The first renamed, the second removed, a new one added; the link emptied.
        $values = $this->values([
            'sanctionLetterLink' => '',
            'milestones' => [
                ['id' => $stored[0]->id, 'name' => 'Prototype v2', 'deliverable' => 'Demo', 'dueDate' => '2027-01-01', 'status' => 'Completed'],
                ['name' => 'Handover', 'deliverable' => '', 'dueDate' => '', 'status' => 'Not Started'],
            ],
        ]);
        $this->actingAs($pi)->post("/api/projects/wizard/{$id}", ['values' => json_encode($values)], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('message', 'Project updated.');

        $this->assertSame(['Prototype v2', 'Handover'], ProjectMilestone::where('project_id', $id)->orderBy('id')->pluck('name')->all());
        $this->assertSame($stored[0]->id, ProjectMilestone::where('project_id', $id)->orderBy('id')->value('id'));
        $this->assertNull(Project::find($id)->sanction_letter_link);
    }

    public function test_a_refused_part_leaves_no_half_project(): void
    {
        $pi = $this->pi();
        $before = Project::count();
        $values = $this->values(['milestones' => [['name' => 'Odd', 'deliverable' => '', 'dueDate' => '', 'status' => 'Sideways']]]);

        $this->actingAs($pi)->post('/api/projects/wizard', ['values' => json_encode($values)], ['Accept' => 'application/json'])->assertStatus(422);
        $this->assertSame($before, Project::count());
    }

    public function test_a_missing_answer_names_its_step(): void
    {
        $this->actingAs($this->pi())->post('/api/projects/wizard', ['values' => json_encode($this->values(['sanctionAmount' => '12.5']))], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJson(['step' => 2, 'message' => 'Enter the total sanctioned amount in whole rupees on the Budget step before submitting.']);
    }
}
