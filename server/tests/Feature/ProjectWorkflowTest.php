<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * A project from creation to deletion, as its PI, with every other kind of
 * reader checked at each point it could go wrong: the department reads but
 * does not write, a faculty member elsewhere neither reads nor writes, and a
 * scholar cannot reach projects at all. Files replaced or deleted along the
 * way must leave the disk, not just the row.
 */
class ProjectWorkflowTest extends TestCase
{
    use DatabaseTransactions;

    private function account(string $email): User
    {
        $user = User::where('email', $email)->first();
        if (!$user) {
            $this->markTestSkipped("No {$email}. Seed TestFixturesSeeder.");
        }
        return $user;
    }

    private function relative(string $stored): string
    {
        return preg_replace('#^/?app/public/#', '', $stored);
    }

    public function test_a_project_from_creation_to_deletion(): void
    {
        Storage::fake('public');
        $pi = $this->account('supervisor@fixture.test');
        $head = $this->account('hod@fixture.test');
        $outsider = $this->account('outsider@fixture.test');
        $scholar = $this->account('scholar@fixture.test');

        // Create.
        $this->actingAs($scholar)->postJson('/api/projects', ['title' => 'Nope', 'category' => 'Research'])->assertForbidden();
        $created = $this->actingAs($pi)->postJson('/api/projects', [
            'title' => 'Sweep project',
            'category' => 'Research',
            'status' => 'Active',
            'duration_years' => 2,
            'objectives' => ['First objective'],
        ])->assertCreated();
        $id = $created->json('id');
        $this->assertSame($pi->faculty->faculty_code, (int) $created->json('pi_faculty_code'));

        // Read: PI edits, department reads only, outsider and scholar see nothing.
        $this->actingAs($pi)->getJson("/api/projects/{$id}")->assertOk()->assertJsonPath('can_edit', true);
        $this->actingAs($head)->getJson("/api/projects/{$id}")->assertOk()->assertJsonPath('can_edit', false);
        $this->actingAs($outsider)->getJson("/api/projects/{$id}")->assertForbidden();
        $this->actingAs($scholar)->getJson("/api/projects/{$id}")->assertForbidden();

        // Milestones.
        $milestone = $this->actingAs($pi)->postJson("/api/projects/{$id}/milestones", ['name' => 'Kick-off'])->assertCreated();
        $this->actingAs($pi)->postJson("/api/projects/{$id}/milestones/{$milestone->json('id')}", ['status' => 'Completed'])
            ->assertOk()->assertJsonPath('milestone.status', 'Completed');
        $this->actingAs($head)->postJson("/api/projects/{$id}/milestones", ['name' => 'Not theirs'])->assertForbidden();
        $this->actingAs($outsider)->deleteJson("/api/projects/{$id}/milestones/{$milestone->json('id')}")->assertForbidden();

        // Documents, a file and a link.
        $document = $this->actingAs($pi)->post("/api/projects/{$id}/documents", [
            'name' => 'Report',
            'file' => UploadedFile::fake()->create('report.pdf', 20, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertCreated();
        $documentPath = $this->relative($document->json('file_path'));
        Storage::disk('public')->assertExists($documentPath);
        $this->actingAs($pi)->postJson("/api/projects/{$id}/documents", ['name' => 'Site', 'link' => 'https://example.invalid'])->assertCreated();
        $this->actingAs($pi)->postJson("/api/projects/{$id}/documents", ['name' => 'Empty'])->assertStatus(400);

        // Replacing the Gantt chart removes the old file once the new one is saved.
        $first = $this->actingAs($pi)->post("/api/projects/{$id}", [
            'gantt_chart' => UploadedFile::fake()->create('gantt-1.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();
        $firstGantt = $this->relative($first->json('project.gantt_chart_path'));
        $second = $this->actingAs($pi)->post("/api/projects/{$id}", [
            'title' => 'Sweep project, renamed',
            'gantt_chart' => UploadedFile::fake()->create('gantt-2.pdf', 10, 'application/pdf'),
        ], ['Accept' => 'application/json'])->assertOk();
        $secondGantt = $this->relative($second->json('project.gantt_chart_path'));
        Storage::disk('public')->assertMissing($firstGantt);
        Storage::disk('public')->assertExists($secondGantt);
        $this->assertSame('Sweep project, renamed', $second->json('project.title'));

        $this->actingAs($head)->postJson("/api/projects/{$id}", ['title' => 'Taken'])->assertForbidden();
        $this->actingAs($outsider)->deleteJson("/api/projects/{$id}")->assertForbidden();

        // Delete takes the rows and the files.
        $this->actingAs($pi)->deleteJson("/api/projects/{$id}")->assertOk();
        $this->assertDatabaseMissing('projects', ['id' => $id]);
        $this->assertDatabaseMissing('project_milestones', ['project_id' => $id]);
        Storage::disk('public')->assertMissing($documentPath);
        Storage::disk('public')->assertMissing($secondGantt);
    }
}
