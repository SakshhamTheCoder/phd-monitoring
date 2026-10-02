<?php

namespace Tests\Feature;

use App\Models\IrbSubForm;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * A chain stops dead when the holder of a step has left the institute, and the
 * only way through was to move the form's stage by hand, which afterwards reads
 * as though that step had been answered when nobody answered it.
 *
 * `can_approve_any_step` lets the admin answer the step the form is waiting on,
 * as that step. It covers the office chain only, and the DORDC does not hold it:
 * they are the office for every page, but the approvals they give are their own.
 */
class TheOfficeAnswersAStalledStepTest extends TestCase
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

    /** An IRB submission sitting on the head of department, with their step open. */
    private function waitingOnTheHead(): IrbSubForm
    {
        $student = Student::firstOrFail();

        $form = new IrbSubForm();
        $form->forceFill([
            'student_id' => $student->roll_no,
            'stage' => 'hod',
            'status' => 'pending',
            'completion' => 'incomplete',
            'steps' => ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'],
            'current_step' => 4,
            'maximum_step' => 4,
            // Every lock closed except the step the form is waiting on, which is
            // how a form reads when it has reached that step and no further. The
            // columns default to closed, so the open one has to be said.
            'student_lock' => true,
            'supervisor_lock' => true,
            'doctoral_lock' => true,
            'phd_coordinator_lock' => true,
            'hod_lock' => false,
            'dra_lock' => false,
            'dordc_lock' => false,
        ])->save();

        return $form->fresh();
    }

    public function test_the_admin_answers_the_step_the_form_is_waiting_on(): void
    {
        $form = $this->waitingOnTheHead();

        $this->actingAs($this->account('admin'), 'sanctum')
            ->postJson("/api/forms/irb-submission/{$form->id}", ['approval' => true])
            ->assertOk();

        $form->refresh();
        $this->assertTrue((bool) $form->hod_lock, 'the step the admin answered is closed');
        $this->assertSame('dra', $form->stage, 'and the form has moved to the one after it');
    }

    public function test_the_dordc_is_the_office_but_answers_only_their_own_step(): void
    {
        $form = $this->waitingOnTheHead();
        $dordc = $this->account('dordc');

        $this->assertFalse($dordc->may('can_approve_any_step'), 'that one capability is the admin role\'s');

        $this->actingAs($dordc, 'sanctum')
            ->postJson("/api/forms/irb-submission/{$form->id}", ['approval' => true])
            ->assertStatus(403);

        $this->assertSame('hod', $form->fresh()->stage, 'the form is where it was');
    }

    public function test_nobody_else_gets_past_a_step_that_is_not_theirs(): void
    {
        $form = $this->waitingOnTheHead();

        foreach (['dra', 'director', 'faculty'] as $role) {
            $this->actingAs($this->account($role), 'sanctum')
                ->postJson("/api/forms/irb-submission/{$form->id}", ['approval' => true])
                ->assertStatus(403);
        }

        $this->assertSame('hod', $form->fresh()->stage);
    }

    /**
     * The scholar's own step, their supervisor's and their committee's belong to
     * a particular person, so the office standing in for them would mean nothing.
     */
    public function test_the_office_does_not_answer_for_the_scholar_or_their_supervisor(): void
    {
        foreach (['student', 'supervisor', 'doctoral'] as $stage) {
            $form = $this->waitingOnTheHead();
            $form->forceFill(['stage' => $stage])->save();

            $this->actingAs($this->account('admin'), 'sanctum')
                ->postJson("/api/forms/irb-submission/{$form->id}", ['approval' => true])
                ->assertStatus(403);

            $this->assertSame($stage, $form->fresh()->stage, $stage . ' is nobody else\'s to answer');
        }
    }

    public function test_the_capability_is_the_admin_roles_alone(): void
    {
        $holders = Role::query()->where('can_approve_any_step', 'true')->pluck('role')->all();

        $this->assertSame(['admin'], $holders);
    }

    public function test_the_dordc_holds_every_other_capability_the_office_does(): void
    {
        $admin = (array) DB::table('roles')->where('role', 'admin')->first();
        $dordc = (array) DB::table('roles')->where('role', 'dordc')->first();

        $missing = collect($admin)
            ->filter(fn ($value, $column) => str_starts_with($column, 'can_') && $value === 'true')
            ->keys()
            ->reject(fn ($column) => $dordc[$column] === 'true')
            ->values()
            ->all();

        $this->assertSame(['can_approve_any_step'], $missing);
    }
}
