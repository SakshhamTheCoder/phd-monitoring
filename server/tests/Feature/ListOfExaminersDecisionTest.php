<?php

namespace Tests\Feature;

use App\Models\Examiner;
use App\Models\ExaminersRecommendation;
use App\Models\ListOfExaminersForm;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * DoRDC's approve/reject was keyed by the examiner's email, which is not unique
 * within a form: the same address on both lists stored two rows, and one email
 * could only ever reach the first of them. The second stayed pending, the
 * "nothing may be left pending" gate never passed, and the form could not be
 * moved on or sent back by anyone.
 */
class ListOfExaminersDecisionTest extends TestCase
{
    use DatabaseTransactions;

    private function formWithExaminers(string $sharedEmail): ListOfExaminersForm
    {
        $student = Student::query()->get()->first(fn ($s) => $s->supervisors->count() > 0);

        if (!$student) {
            $this->markTestSkipped('No student in this database has a supervisor.');
        }

        $form = ListOfExaminersForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'stage' => 'dordc',
            'steps' => ['faculty', 'hod', 'dordc', 'director', 'complete'],
        ]);

        // The locks default to closed; the form is sitting with DoRDC.
        $form->dordc_lock = false;
        $form->save();

        $supervisor = $student->supervisors->first()->faculty_code;

        // One person in the directory, proposed onto both lists. The supervisor
        // step refuses this now, but a form that predates that check still has
        // to be decidable.
        $examiner = Examiner::fromDetails([
            'name' => 'Shared Person',
            'email' => $sharedEmail,
            'institution' => 'Somewhere',
            'designation' => 'Professor',
            'department' => 'CSE',
            'phone' => '9000000000',
        ]);

        foreach (['national', 'international'] as $type) {
            ExaminersRecommendation::create([
                'form_id' => $form->id,
                'examiner_id' => $examiner->id,
                'faculty_id' => $supervisor,
                'type' => $type,
            ]);
        }

        return $form;
    }

    private function actAsDordc(): void
    {
        $role = Role::where('role', 'dordc')->firstOrFail();
        $user = User::where('role_id', $role->id)->whereHas('faculty')->first();

        if (!$user) {
            $this->markTestSkipped('No DoRDC user with a faculty record in this database.');
        }

        $user->current_role_id = $role->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');
    }

    /** Both rows are reachable, so neither can be left pending. */
    public function test_one_email_on_both_lists_still_gets_two_decisions(): void
    {
        $form = $this->formWithExaminers('shared@example.invalid');
        $rows = ExaminersRecommendation::where('form_id', $form->id)->get();
        $this->assertCount(2, $rows, 'one person on both lists is two rows, one per list');
        $this->assertSame(
            $rows[0]->examiner_id,
            $rows[1]->examiner_id,
            'both rows should point at the one directory entry'
        );

        $this->actAsDordc();

        $response = $this->postJson("/api/forms/list-of-examiners/{$form->id}", [
            'approval' => true,
            'approvals' => [$rows[0]->id],
            'rejections' => [$rows[1]->id],
        ]);
        // Two examiners is below the four-per-list minimum, so the form is
        // handed back. What matters here is that both rows were decided on the
        // way: before the fix the second stayed pending and no submission,
        // forward or back, could ever succeed.
        $this->assertSame('approved', $rows[0]->fresh()->recommendation);
        $this->assertSame('rejected', $rows[1]->fresh()->recommendation);
        $this->assertSame(
            0,
            ExaminersRecommendation::where('form_id', $form->id)->where('recommendation', 'pending')->count(),
            'no examiner may be left undecided once DoRDC has ruled on every row'
        );

        $response->assertStatus(403);
        $this->assertStringContainsString('Returned to the supervisor', $response->json('message'));
        $this->assertSame('supervisor', $form->fresh()->stage);
    }
}
