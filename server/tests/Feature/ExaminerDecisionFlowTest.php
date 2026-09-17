<?php

namespace Tests\Feature;

use App\Models\Examiner;
use App\Models\Forms;
use App\Models\ExaminersRecommendation;
use App\Models\ListOfExaminersForm;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * List of Examiners decides examiner by examiner, not form by form.
 *
 * Every other form is one yes or no. Here the supervisor proposes a national and
 * an international list, and the DoRDC answers each name on them. The form only
 * moves when nobody is left undecided and at least four are approved on each
 * list; short of that it goes back to the supervisor to add more.
 *
 * ListOfExaminersDecisionTest covers one narrow case, a person on both lists.
 * ExaminerListOverlapTest covers what the supervisor may propose. Neither covers
 * the decision rules themselves, which is what this does.
 */
class ExaminerDecisionFlowTest extends TestCase
{
    use DatabaseTransactions;

    private const REQUIRED_PER_LIST = 4;

    private function scholarWithSupervisor(): Student
    {
        $student = Student::query()->get()->first(fn ($s) => $s->supervisors->count() > 0);

        if (!$student) {
            $this->markTestSkipped('No scholar in this database has a supervisor.');
        }

        return $student;
    }

    /** A form parked with the DoRDC, carrying $perList names on each list. */
    private function formAwaitingDordc(int $perList): ListOfExaminersForm
    {
        $student = $this->scholarWithSupervisor();

        $form = ListOfExaminersForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'stage' => 'dordc',
            'steps' => ['faculty', 'dordc', 'director', 'complete'],
        ]);
        $form->dordc_lock = false;
        $form->save();

        // Advancing a form also advances its row in `forms`, the index the
        // scholar's form list is built from. createForms() makes it.
        Forms::updateOrCreate(
            ['form_type' => 'list-of-examiners', 'student_id' => $student->roll_no],
            [
                'form_name' => 'List of Examiners',
                'department_id' => $student->department_id,
                'stage' => 'dordc',
                'max_count' => 1,
                'count' => 1,
                'steps' => ['faculty', 'dordc', 'director', 'complete'],
            ]
        );

        $supervisor = $student->supervisors->first()->faculty_code;

        foreach (['national', 'international'] as $type) {
            for ($i = 0; $i < $perList; $i++) {
                $examiner = Examiner::fromDetails([
                    'name' => ucfirst($type) . ' Examiner ' . $i,
                    'email' => Str::lower(Str::random(10)) . '@examiner.test',
                    'institution' => 'Somewhere',
                    'designation' => 'Professor',
                    'department' => 'CSE',
                    'phone' => '9000000000',
                ]);

                ExaminersRecommendation::create([
                    'form_id' => $form->id,
                    'examiner_id' => $examiner->id,
                    'faculty_id' => $supervisor,
                    'type' => $type,
                ]);
            }
        }

        return $form;
    }

    private function actAsDordc(): User
    {
        $role = Role::where('role', 'dordc')->firstOrFail();
        $user = User::where('role_id', $role->id)->whereHas('faculty')->first();

        if (!$user) {
            $this->markTestSkipped('No DoRDC user with a faculty record in this database.');
        }

        $user->current_role_id = $role->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        return $user->fresh();
    }

    private function idsOn(ListOfExaminersForm $form, string $type): array
    {
        return ExaminersRecommendation::where('form_id', $form->id)
            ->where('type', $type)
            ->pluck('id')
            ->all();
    }

    private function decide(ListOfExaminersForm $form, array $body)
    {
        return $this->postJson('/api/forms/list-of-examiners/' . $form->id, $body);
    }

    public function test_nobody_may_be_left_undecided(): void
    {
        $form = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $this->actAsDordc();

        // Every national name answered, the international list untouched.
        $this->decide($form, [
            'approval' => true,
            'approvals' => $this->idsOn($form, 'national'),
            'rejections' => [],
        ])->assertStatus(403)
          ->assertJsonPath('message', 'All examiners must be either approved or rejected before the form can be submitted');

        $this->assertSame('dordc', $form->fresh()->stage, 'the form must not move while names are undecided');
    }

    public function test_each_name_keeps_the_verdict_it_was_given(): void
    {
        $form = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $this->actAsDordc();

        $national = $this->idsOn($form, 'national');
        $international = $this->idsOn($form, 'international');
        $rejected = array_shift($national);

        // One name turned down, so the national list is one short of the four
        // it needs. The verdicts still have to stick.
        $this->decide($form, [
            'approval' => true,
            'approvals' => array_merge($national, $international),
            'rejections' => [$rejected],
        ]);

        $this->assertSame('rejected', ExaminersRecommendation::find($rejected)->recommendation);
        foreach ($national as $id) {
            $this->assertSame('approved', ExaminersRecommendation::find($id)->recommendation);
        }
    }

    public function test_a_list_left_short_goes_back_to_the_supervisor(): void
    {
        $form = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $this->actAsDordc();

        $national = $this->idsOn($form, 'national');
        $international = $this->idsOn($form, 'international');
        $rejected = array_shift($national);

        $response = $this->decide($form, [
            'approval' => true,
            'approvals' => array_merge($national, $international),
            'rejections' => [$rejected],
        ]);

        $response->assertStatus(403);
        $this->assertStringContainsString('Returned to the supervisor', $response->json('message'));
        $this->assertStringContainsString('3 national', $response->json('message'));

        $fresh = $form->fresh();
        $this->assertSame('supervisor', $fresh->stage, 'the form goes back a step');
        $this->assertFalse((bool) $fresh->supervisor_lock, 'and the supervisor is let back in');
    }

    public function test_a_full_pair_of_lists_moves_the_form_to_the_director(): void
    {
        $form = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $this->actAsDordc();

        $this->decide($form, [
            'approval' => true,
            'approvals' => array_merge($this->idsOn($form, 'national'), $this->idsOn($form, 'international')),
            'rejections' => [],
        ])->assertStatus(200);

        $this->assertSame('director', $form->fresh()->stage);
    }

    public function test_more_than_the_minimum_is_allowed(): void
    {
        $form = $this->formAwaitingDordc(self::REQUIRED_PER_LIST + 2);
        $this->actAsDordc();

        $national = $this->idsOn($form, 'national');
        $international = $this->idsOn($form, 'international');

        // Two turned down on each list still leaves the required four.
        $this->decide($form, [
            'approval' => true,
            'approvals' => array_merge(array_slice($national, 2), array_slice($international, 2)),
            'rejections' => array_merge(array_slice($national, 0, 2), array_slice($international, 0, 2)),
        ])->assertStatus(200);

        $this->assertSame('director', $form->fresh()->stage);
    }

    public function test_the_decision_lists_are_required(): void
    {
        $form = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $this->actAsDordc();

        $this->decide($form, ['approval' => true])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['approvals']);
    }

    public function test_a_decision_on_a_name_from_another_form_is_ignored(): void
    {
        $mine = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $other = $this->formAwaitingDordc(self::REQUIRED_PER_LIST);
        $this->actAsDordc();

        $strayId = $this->idsOn($other, 'national')[0];

        $this->decide($mine, [
            'approval' => true,
            'approvals' => array_merge($this->idsOn($mine, 'national'), $this->idsOn($mine, 'international')),
            'rejections' => [$strayId],
        ]);

        // recordDecisions scopes by form_id, so the other form's row is untouched.
        $this->assertSame('pending', ExaminersRecommendation::find($strayId)->recommendation);
    }
}
