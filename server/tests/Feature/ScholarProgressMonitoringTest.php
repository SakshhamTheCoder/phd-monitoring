<?php

namespace Tests\Feature;

use App\Models\Presentation;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Progress monitoring opened from a scholar's profile.
 *
 * The route nests the scholar ahead of the semester, and the controller read
 * its parameters by position, so the scholar's roll number arrived where a
 * semester code was expected and the page died on "Invalid Semester Code".
 */
class ScholarProgressMonitoringTest extends TestCase
{
    use DatabaseTransactions;

    private function asAdmin(): void
    {
        $admin = User::query()->first();
        $admin->current_role_id = Role::where('role', 'admin')->value('id');
        $admin->save();
        $this->actingAs($admin->fresh());
    }

    public function test_the_page_lists_only_that_scholars_evaluations(): void
    {
        $presentation = Presentation::query()->first();

        if (!$presentation) {
            $this->markTestSkipped('No presentation in this database.');
        }

        $this->asAdmin();

        $response = $this->getJson("/api/students/{$presentation->student_id}/forms/presentation");

        $response->assertOk();
        $rolls = collect($response->json('data'))->pluck('roll_no')->unique();
        $this->assertSame([$presentation->student_id], $rolls->values()->all());
        $this->assertSame(['period', 'date', 'time', 'progress'], $response->json('fields'));
    }

    public function test_a_single_evaluation_opens_under_the_scholar(): void
    {
        $presentation = Presentation::query()->first();

        if (!$presentation) {
            $this->markTestSkipped('No presentation in this database.');
        }

        $this->asAdmin();

        $response = $this->getJson(
            "/api/students/{$presentation->student_id}/forms/presentation"
            . "/semester/{$presentation->period_of_report}/{$presentation->id}"
        );

        $response->assertOk();
        $this->assertSame($presentation->id, $response->json('form_id'));
    }
}
