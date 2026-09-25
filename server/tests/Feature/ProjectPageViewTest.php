<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/** One project's page as the server phrases it, and what its readers may do. */
class ProjectPageViewTest extends TestCase
{
    use DatabaseTransactions;

    public function test_the_page_phrases_the_project_and_offers_changes_to_its_writers(): void
    {
        $pi = User::where('email', 'supervisor@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        $head = User::where('email', 'hod@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        $outsider = User::where('email', 'outsider@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        $id = $this->actingAs($pi)->postJson('/api/projects', [
            'title' => 'Page project', 'category' => 'Research', 'status' => 'Active', 'amount' => 4850000,
            'duration_years' => 2, 'sdgs' => [7],
        ])->assertCreated()->json('id');
        $this->actingAs($pi)->postJson("/api/projects/{$id}/milestones", ['name' => 'Kick-off', 'status' => 'Completed'])->assertCreated();
        $this->actingAs($pi)->postJson("/api/projects/{$id}/milestones", ['name' => 'Build'])->assertCreated();

        $view = $this->actingAs($pi)->getJson("/api/views/project?id={$id}")->assertOk()->json();
        $this->assertSame(['₹ ', '48,50,000'], $view['facts'][1]['value']);
        $this->assertSame([50, ['1', ' of ', '2', ' milestones completed']], [$view['progress']['percent'], $view['progress']['note']]);
        $this->assertSame(['7', '. ', 'Affordable and Clean Energy'], $view['overview']['sdgs'][0]['text']);
        $this->assertSame(['completed', 'fa-check'], [$view['milestones'][0]['class'], $view['milestones'][0]['icon']]);
        $this->assertSame('Edit project', $view['actions'][0]['label']);

        // The department reads it without the changes; someone else is told it is not there.
        $read = $this->actingAs($head)->getJson("/api/views/project?id={$id}")->assertOk()->json();
        $this->assertSame([false, []], [$read['can_edit'], $read['actions']]);
        $this->assertNull($this->actingAs($outsider)->getJson("/api/views/project?id={$id}")->assertOk()->json('id'));
    }
}
