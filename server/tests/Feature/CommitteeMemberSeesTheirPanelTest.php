<?php

namespace Tests\Feature;

use App\Models\Presentation;
use App\Models\User;
use Database\Seeders\TestFixturesSeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * A committee member opening an evaluation while holding 'faculty'. The loader
 * already treats them as the committee, but the payload said 'faculty', so the
 * page drew the chain only as far as the supervisor and gave them nothing to
 * answer. Found driving an evaluation through the browser.
 */
class CommitteeMemberSeesTheirPanelTest extends TestCase
{
    use DatabaseTransactions;

    private function committeeMember(): User
    {
        $member = User::where('email', 'faculty@fixture.test')->first();
        if (!$member?->faculty) {
            $this->markTestSkipped('No faculty@fixture.test with a faculty row. Seed TestFixturesSeeder.');
        }

        DB::table('doctoral_commitee')->insert([
            'faculty_id' => $member->faculty->faculty_code,
            'student_id' => TestFixturesSeeder::STUDENT_ROLL,
            'type' => 'internal',
        ]);

        return $member;
    }

    /** IRB Submission refused them outright: it never read committee membership. */
    public function test_an_irb_submission_at_the_committee_step_opens_for_them(): void
    {
        $member = $this->committeeMember();
        $form = \App\Models\IrbSubForm::create([
            'student_id' => TestFixturesSeeder::STUDENT_ROLL,
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'doctoral',
            'maximum_step' => 3,
            'steps' => ['student', 'faculty', 'external', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'],
        ]);

        $this->actingAs($member)
            ->getJson("/api/forms/irb-submission/{$form->id}")
            ->assertOk()
            ->assertJsonPath('role', 'doctoral');
    }

    public function test_the_payload_names_the_committee_step_they_act_as(): void
    {
        $member = $this->committeeMember();
        $evaluation = Presentation::create([
            'student_id' => TestFixturesSeeder::STUDENT_ROLL,
            'period_of_report' => '2627ODD',
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'doctoral',
            'maximum_step' => 2,
            'steps' => ['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'],
        ]);

        $this->actingAs($member)
            ->getJson("/api/presentation/semester/2627ODD/{$evaluation->id}")
            ->assertOk()
            ->assertJsonPath('role', 'doctoral');
    }
}
