<?php

namespace Tests\Feature;

use App\Models\ExaminersRecommendation;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\ListOfExaminersForm;
use App\Models\Role;
use App\Models\Student;
use App\Models\Supervisor;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * A supervisor may not send the same panel to every scholar.
 *
 * At most half of a proposed list may be people they have already proposed on
 * any one earlier list, counted separately for national and international. The
 * rule was written once and left commented out, against a schema that has since
 * moved the examiner's address out to a shared directory, so nothing enforced
 * it.
 *
 * Driven through the HTTP endpoint as the supervisor, because the check has to
 * hold where a supervisor actually submits, and because it must run before
 * anything is written: the two lists are processed one after the other and no
 * transaction wraps them.
 */
class ExaminerListOverlapTest extends TestCase
{
    use DatabaseTransactions;

    private Faculty $supervisor;

    /** @var array<string, Student> */
    private array $students = [];

    protected function setUp(): void
    {
        parent::setUp();

        $supervisor = Faculty::query()->whereHas('user')->first();
        if (!$supervisor) {
            $this->markTestSkipped('No faculty with a user account in this database.');
        }

        $this->supervisor = $supervisor;
        $this->students = [
            'first' => $this->makeStudent(1),
            'second' => $this->makeStudent(2),
        ];
    }

    /** A scholar of this supervisor, created for the run and rolled back after. */
    private function makeStudent(int $n): Student
    {
        $rollNo = 880000 + $n;

        $user = User::create([
            'first_name' => 'Overlap',
            'last_name' => 'Scholar ' . $n,
            'email' => "overlap.scholar{$n}@example.invalid",
            'password' => bcrypt('not-used'),
            'role_id' => Role::where('role', 'student')->firstOrFail()->id,
            'current_role_id' => Role::where('role', 'student')->firstOrFail()->id,
            'status' => 'active',
        ]);

        $student = Student::create([
            'roll_no' => $rollNo,
            'user_id' => $user->id,
            'department_id' => $this->supervisor->department_id,
            'date_of_registration' => now()->subYear()->toDateString(),
            'current_status' => 'full-time',
            'overall_progress' => 0,
        ]);

        Supervisor::create([
            'student_id' => $rollNo,
            'faculty_id' => $this->supervisor->faculty_code,
        ]);

        return $student->fresh();
    }

    /**
     * A form sitting with the supervisor, which is where the check runs.
     *
     * The registry row beside it is what the chain writes each role's
     * availability back to as the form advances, so a form without one cannot
     * be moved on at all.
     */
    private function formFor(Student $student): ListOfExaminersForm
    {
        Forms::firstOrCreate(
            ['student_id' => $student->roll_no, 'form_type' => 'list-of-examiners'],
            [
                'form_name' => 'List of Examiners',
                'department_id' => $student->department_id,
                'steps' => ['faculty', 'hod', 'dordc', 'director', 'complete'],
                'stage' => 'supervisor',
                'max_level' => 4,
                'current_level' => 0,
                'count' => 1,
                'max_count' => 1,
                'student_available' => false,
                'supervisor_available' => true,
                'hod_available' => false,
                'dordc_available' => false,
                'director_available' => false,
            ],
        );

        $form = ListOfExaminersForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'stage' => 'supervisor',
            'steps' => ['faculty', 'hod', 'dordc', 'director', 'complete'],
        ]);

        $form->supervisor_lock = false;
        $form->save();

        return $form;
    }

    /**
     * Four examiners, named so a test reads as the people it shares or replaces.
     *
     * @param  array<int, string>  $handles
     * @return array<int, array<string, string>>
     */
    private function panel(array $handles): array
    {
        return array_map(fn ($handle) => [
            'name' => ucfirst($handle) . ' Examiner',
            'email' => $handle . '@example.invalid',
            'institution' => 'Somewhere University',
            'designation' => 'Professor',
            'department' => 'CSE',
            'phone' => '9000000000',
        ], $handles);
    }

    private function actAsSupervisor(): void
    {
        $role = Role::where('role', 'faculty')->firstOrFail();
        $user = $this->supervisor->user;
        $user->current_role_id = $role->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');
    }

    /**
     * @param  array<int, string>  $national
     * @param  array<int, string>  $international
     */
    private function propose(ListOfExaminersForm $form, array $national, array $international)
    {
        return $this->postJson("/api/forms/list-of-examiners/{$form->id}", [
            'approval' => true,
            'national' => $this->panel($national),
            'international' => $this->panel($international),
        ]);
    }

    public function test_a_supervisor_may_not_repeat_more_than_half_of_an_earlier_list(): void
    {
        $this->actAsSupervisor();

        $first = $this->formFor($this->students['first']);
        $this->propose(
            $first,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        )->assertOk();

        $this->assertSame(
            8,
            ExaminersRecommendation::where('form_id', $first->id)->count(),
            'the first scholar sets the baseline, so it is accepted whole'
        );

        // Three of four repeated is 75%, over the limit.
        $second = $this->formFor($this->students['second']);
        $response = $this->propose(
            $second,
            ['nat-a', 'nat-b', 'nat-c', 'nat-new'],
            ['int-p', 'int-q', 'int-r', 'int-s'],
        );

        $response->assertStatus(403);
        $this->assertStringContainsString('the national list repeats 3', $response->json('message'));
        $this->assertStringContainsString((string) $this->students['first']->roll_no, $response->json('message'));

        $this->assertSame(
            0,
            ExaminersRecommendation::where('form_id', $second->id)->count(),
            'a refused proposal must write nothing, not even the list that passed'
        );
    }

    public function test_exactly_half_is_allowed(): void
    {
        $this->actAsSupervisor();

        $first = $this->formFor($this->students['first']);
        $this->propose(
            $first,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        )->assertOk();

        $second = $this->formFor($this->students['second']);
        $this->propose(
            $second,
            ['nat-a', 'nat-b', 'nat-new1', 'nat-new2'],
            ['int-a', 'int-b', 'int-new1', 'int-new2'],
        )->assertOk();

        $this->assertSame(8, ExaminersRecommendation::where('form_id', $second->id)->count());
    }

    /** The two lists have their own allowance, so one cannot spend the other's. */
    public function test_the_lists_are_counted_separately(): void
    {
        $this->actAsSupervisor();

        $first = $this->formFor($this->students['first']);
        $this->propose(
            $first,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        )->assertOk();

        // National repeats nothing; international repeats all four.
        $second = $this->formFor($this->students['second']);
        $response = $this->propose(
            $second,
            ['nat-w', 'nat-x', 'nat-y', 'nat-z'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        );

        $response->assertStatus(403);
        $this->assertStringContainsString('the international list repeats 4', $response->json('message'));
        $this->assertStringNotContainsString('the national list repeats', $response->json('message'));
    }

    /** Resubmitting one's own form is not a repeat of the list it replaces. */
    public function test_a_scholars_own_earlier_rows_do_not_block_their_resubmission(): void
    {
        $this->actAsSupervisor();

        $form = $this->formFor($this->students['first']);
        $this->propose(
            $form,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        )->assertOk();

        // Sent back by the HoD, then submitted again unchanged. Refreshed first:
        // the submit above advanced the row, and saving a stale model would find
        // nothing dirty and leave the lock closed.
        $form->refresh();
        $form->supervisor_lock = false;
        $form->stage = 'supervisor';
        $form->save();

        $again = $this->propose(
            $form,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        );
        $again->assertOk($again->json('message'));
    }

    /** Someone DoRDC turned down never examined that thesis. */
    public function test_a_rejected_examiner_may_be_proposed_again(): void
    {
        $this->actAsSupervisor();

        $first = $this->formFor($this->students['first']);
        $this->propose(
            $first,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-a', 'int-b', 'int-c', 'int-d'],
        )->assertOk();

        ExaminersRecommendation::where('form_id', $first->id)
            ->where('type', 'national')
            ->limit(2)
            ->update(['recommendation' => 'rejected']);

        // Four repeated, but two of them were rejected, so only two count.
        $second = $this->formFor($this->students['second']);
        $this->propose(
            $second,
            ['nat-a', 'nat-b', 'nat-c', 'nat-d'],
            ['int-p', 'int-q', 'int-r', 'int-s'],
        )->assertOk();
    }
}
