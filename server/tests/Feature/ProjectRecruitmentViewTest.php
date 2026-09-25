<?php

namespace Tests\Feature;

use App\Models\FeatureFlag;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/** A project's recruitment as the server phrases it, applicants for the PI only. */
class ProjectRecruitmentViewTest extends TestCase
{
    use DatabaseTransactions;

    public function test_positions_are_phrased_and_applicants_stay_with_the_pi(): void
    {
        $pi = User::where('email', 'supervisor@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        $head = User::where('email', 'hod@fixture.test')->first() ?? $this->markTestSkipped('Seed TestFixturesSeeder.');
        FeatureFlag::query()->updateOrCreate(['key' => 'job_openings'], ['enabled' => true]);
        $id = $this->actingAs($pi)->postJson('/api/projects', ['title' => 'Recruiting project', 'category' => 'Research'])->assertCreated()->json('id');
        $this->actingAs($pi)->postJson("/api/projects/{$id}/positions", ['type' => 'JRF', 'title' => 'Fellow', 'openings' => 2])->assertCreated();

        $view = $this->actingAs($pi)->getJson("/api/views/project-recruitment?id={$id}")->assertOk()->json();
        $position = $view['positions'][0];
        $this->assertSame(['0', ' / ', '2'], $position['stats'][0]['value']);
        $this->assertSame(['Close position', 'Closed'], [$position['toggle']['label'], $position['toggle']['status']]);
        $this->assertSame('Delete the position "Fellow"? This cannot be undone.', $position['delete']);
        $this->assertTrue($view['can_edit']);

        $read = $this->actingAs($head)->getJson("/api/views/project-recruitment?id={$id}")->assertOk()->json();
        $this->assertSame([false, [], null], [$read['can_edit'], $read['applications'], $read['none']['hint']]);
    }
}
