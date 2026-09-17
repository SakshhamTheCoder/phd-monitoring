<?php

namespace Tests\Feature;

use App\Models\ConstituteOfIRB;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\IRBCommittee;
use App\Models\IrbExpertChairman;
use App\Models\IrbNomineeCognate;
use App\Models\IrbOutsideExpert;
use App\Models\OutsideExpert;
use App\Models\Role;
use App\Models\Forms;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * IRB Constitution end to end, because it is the form where the most roles do
 * something of their own rather than answer yes or no.
 *
 *   student     files it
 *   supervisor  nominates exactly three cognates, none of them a supervisor
 *   HOD         proposes the chairman and outside experts
 *   ADORDC      recommends, nothing bespoke
 *   DORDC       picks one outside expert and one cognate from what was proposed,
 *               and that choice is what constitutes the committee
 *
 * Everything else only tests who may act and in what order. This tests what each
 * of them actually does, and that the later choices are constrained by the
 * earlier ones: the DoRDC cannot appoint somebody nobody proposed.
 */
class IrbConstitutionRoleActionsTest extends TestCase
{
    use DatabaseTransactions;

    /**
     * A step that raises inside its own extraSteps is caught by submitForm and
     * answered 403, the same code as a refusal. Named so the tests below read as
     * what they mean rather than as a bare number.
     */
    private const REFUSED = 403;

    private Department $department;
    private Student $scholar;
    private User $scholarUser;
    private Faculty $supervisor;
    private array $cognateCandidates = [];
    private int $nextFacultyCode = 990700;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'IRBT'],
            ['name' => 'IRB Test Department']
        );

        $this->scholarUser = $this->userAs('student');
        $this->scholar = Student::create([
            'roll_no' => 990501,
            'user_id' => $this->scholarUser->id,
            'department_id' => $this->department->id,
            'date_of_registration' => now()->subYears(2)->toDateString(),
            'current_status' => 'full-time',
            'overall_progress' => 0,
        ]);

        $this->supervisor = $this->facultyFor($this->userAs('faculty'), 990601);
        DB::table('supervisors')->insert([
            'student_id' => $this->scholar->roll_no,
            'faculty_id' => $this->supervisor->faculty_code,
        ]);

        // Handing the form on notifies the next role, and those notifications
        // read the department's officers. A department with no head is not a
        // department any of this code expects to meet.
        $head = $this->facultyFor($this->userAs('hod'), 990605);
        $this->department->forceFill(['hod_id' => $head->faculty_code])->save();

        // Three faculty who do not supervise this scholar, to nominate.
        foreach ([990602, 990603, 990604] as $i => $code) {
            $this->cognateCandidates[] = $this->facultyFor($this->userAs('faculty'), $code);
        }
    }

    private function userAs(string $role): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);

        $user = new User();
        $user->forceFill([
            'first_name' => 'Irb',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@irb.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    /** A reviewer: a user in the role, with the faculty record the code reads. */
    private function reviewer(string $role): User
    {
        $user = $this->userAs($role);
        $faculty = $this->facultyFor($user, $this->nextFacultyCode++);

        if ($role === 'adordc') {
            $this->department->forceFill(['adordc_id' => $faculty->faculty_code])->save();
        }

        return $user->fresh();
    }

    private function facultyFor(User $user, int $code): Faculty
    {
        return Faculty::create([
            'faculty_code' => $code,
            'user_id' => $user->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);
    }

    private function outsideExpert(string $tag): OutsideExpert
    {
        return OutsideExpert::create([
            'first_name' => 'Outside',
            'last_name' => $tag,
            'designation' => 'Professor',
            'institution' => 'Elsewhere Institute',
            'department' => 'Elsewhere',
            'email' => Str::lower($tag . Str::random(5)) . '@outside.test',
        ]);
    }

    /**
     * A form parked at the given stage, with the chain this form really uses.
     *
     * The student's own step opens an approval row for each supervisor, which
     * the supervisor branch then reads. Starting a form later in the chain has
     * to carry those rows too, or it is not the form the next role would be
     * handed in practice.
     */
    private function formAt(string $stage): ConstituteOfIRB
    {
        $form = ConstituteOfIRB::create([
            'student_id' => $this->scholar->roll_no,
            'status' => 'pending',
            'stage' => $stage,
            'steps' => ['student', 'faculty', 'hod', 'adordc', 'dordc', 'complete'],
            'student_lock' => true,
            'supervisor_lock' => $stage === 'supervisor' ? false : true,
            'hod_lock' => $stage === 'hod' ? false : true,
            'adordc_lock' => $stage === 'adordc' ? false : true,
            'dordc_lock' => $stage === 'dordc' ? false : true,
        ]);

        // Every submission also advances the row in `forms`, which is the index
        // the scholar's form list is built from. createForms() makes it; a form
        // built directly here has to carry one too.
        Forms::updateOrCreate(
            ['form_type' => 'irb-constitution', 'student_id' => $this->scholar->roll_no],
            [
                'form_name' => 'IRB Constitution',
                'department_id' => $this->department->id,
                'stage' => $stage,
                'max_count' => 1,
                'count' => 1,
                'steps' => ['student', 'faculty', 'hod', 'adordc', 'dordc', 'complete'],
            ]
        );

        foreach ($this->scholar->supervisors as $supervisor) {
            $form->supervisorApprovals()->create([
                'supervisor_id' => $supervisor->faculty_code,
                'status' => 'awaited',
            ]);
        }

        return $form;
    }

    private function submit(User $user, ConstituteOfIRB $form, array $body)
    {
        return $this->actingAs($user, 'sanctum')
            ->postJson('/api/forms/irb-constitution/' . $form->id, $body);
    }

    // ---------------------------------------------------------------- supervisor

    public function test_the_supervisor_must_nominate_exactly_three_cognates(): void
    {
        $form = $this->formAt('supervisor');
        $two = [$this->cognateCandidates[0]->faculty_code, $this->cognateCandidates[1]->faculty_code];

        $this->submit($this->supervisor->user, $form, ['approval' => true, 'nominee_cognates' => $two])
            ->assertStatus(self::REFUSED);

        $this->assertSame(0, IrbNomineeCognate::where('irb_form_id', $form->id)->count());
        $this->assertSame('supervisor', $form->fresh()->stage, 'a refused submission must not move the form');
    }

    public function test_the_supervisor_cannot_nominate_the_same_person_twice(): void
    {
        $form = $this->formAt('supervisor');
        $code = $this->cognateCandidates[0]->faculty_code;

        $this->submit($this->supervisor->user, $form, [
            'approval' => true,
            'nominee_cognates' => [$code, $code, $this->cognateCandidates[1]->faculty_code],
        ])->assertStatus(self::REFUSED);

        $this->assertSame(0, IrbNomineeCognate::where('irb_form_id', $form->id)->count());
    }

    public function test_the_supervisor_cannot_nominate_themselves(): void
    {
        $form = $this->formAt('supervisor');

        $this->submit($this->supervisor->user, $form, [
            'approval' => true,
            'nominee_cognates' => [
                $this->supervisor->faculty_code,
                $this->cognateCandidates[0]->faculty_code,
                $this->cognateCandidates[1]->faculty_code,
            ],
        ])->assertStatus(self::REFUSED);

        $this->assertSame(0, IrbNomineeCognate::where('irb_form_id', $form->id)->count());
    }

    public function test_three_valid_cognates_are_recorded_and_the_form_moves_on(): void
    {
        $form = $this->formAt('supervisor');
        $codes = array_map(fn ($f) => $f->faculty_code, $this->cognateCandidates);

        $this->submit($this->supervisor->user, $form, ['approval' => true, 'nominee_cognates' => $codes])
            ->assertStatus(200);

        $recorded = IrbNomineeCognate::where('irb_form_id', $form->id)->pluck('nominee_id')->all();
        sort($recorded);
        sort($codes);
        $this->assertSame($codes, array_map('intval', $recorded));
        $this->assertSame('hod', $form->fresh()->stage);
    }

    // ---------------------------------------------------------------- DoRDC

    public function test_the_dordc_cannot_appoint_an_expert_nobody_proposed(): void
    {
        $form = $this->formAt('dordc');

        // Proposed by the HOD and the supervisor.
        $proposed = $this->outsideExpert('Proposed');
        IrbOutsideExpert::create(['irb_form_id' => $form->id, 'expert_id' => $proposed->id, 'hod_id' => 1]);
        IrbNomineeCognate::create([
            'irb_form_id' => $form->id,
            'nominee_id' => $this->cognateCandidates[0]->faculty_code,
            'supervisor_id' => $this->supervisor->faculty_code,
        ]);

        // Never proposed for this form.
        $stranger = $this->outsideExpert('Stranger');

        $this->submit($this->reviewer('dordc'), $form, [
            'approval' => true,
            'outside_expert' => $stranger->id,
            'cognate_expert' => $this->cognateCandidates[0]->faculty_code,
        ])->assertStatus(self::REFUSED);

        $this->assertSame(0, IRBCommittee::where('student_id', $this->scholar->roll_no)->count());
        $this->assertSame('dordc', $form->fresh()->stage);
    }

    public function test_the_dordc_cannot_appoint_a_cognate_nobody_nominated(): void
    {
        $form = $this->formAt('dordc');

        $proposed = $this->outsideExpert('Proposed');
        IrbOutsideExpert::create(['irb_form_id' => $form->id, 'expert_id' => $proposed->id, 'hod_id' => 1]);

        $this->submit($this->reviewer('dordc'), $form, [
            'approval' => true,
            'outside_expert' => $proposed->id,
            // A real faculty member, but never nominated on this form.
            'cognate_expert' => $this->cognateCandidates[2]->faculty_code,
        ])->assertStatus(self::REFUSED);

        $this->assertSame(0, IRBCommittee::where('student_id', $this->scholar->roll_no)->count());
    }

    public function test_a_choice_from_what_was_proposed_constitutes_the_committee(): void
    {
        $form = $this->formAt('dordc');

        $proposed = $this->outsideExpert('Proposed');
        IrbOutsideExpert::create(['irb_form_id' => $form->id, 'expert_id' => $proposed->id, 'hod_id' => 1]);
        IrbNomineeCognate::create([
            'irb_form_id' => $form->id,
            'nominee_id' => $this->cognateCandidates[0]->faculty_code,
            'supervisor_id' => $this->supervisor->faculty_code,
        ]);

        $this->submit($this->reviewer('dordc'), $form, [
            'approval' => true,
            'outside_expert' => $proposed->id,
            'cognate_expert' => $this->cognateCandidates[0]->faculty_code,
        ])->assertStatus(200);

        $this->assertDatabaseHas('irb_committees', [
            'student_id' => $this->scholar->roll_no,
            'type' => 'outside',
            'member_id' => $proposed->id,
        ]);
    }

    public function test_the_dordc_must_name_both_choices(): void
    {
        $form = $this->formAt('dordc');

        $this->submit($this->reviewer('dordc'), $form, ['approval' => true])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['outside_expert', 'cognate_expert']);
    }

    // ---------------------------------------------------------------- order

    public function test_a_later_role_cannot_act_while_the_form_waits_on_an_earlier_one(): void
    {
        $form = $this->formAt('supervisor');

        // The DoRDC's own step is real, but the form has not reached it.
        $this->submit($this->reviewer('dordc'), $form, [
            'approval' => true,
            'outside_expert' => 1,
            'cognate_expert' => 1,
        ])->assertStatus(403);

        $this->assertSame('supervisor', $form->fresh()->stage);
    }

    public function test_a_role_that_has_already_acted_cannot_act_again(): void
    {
        $form = $this->formAt('supervisor');
        $form->supervisor_lock = true;
        $form->save();

        $this->submit($this->supervisor->user, $form, [
            'approval' => true,
            'nominee_cognates' => array_map(fn ($f) => $f->faculty_code, $this->cognateCandidates),
        ])->assertStatus(403);
    }

    public function test_a_rejection_without_a_reason_is_refused(): void
    {
        $form = $this->formAt('adordc');

        $this->submit($this->reviewer('adordc'), $form, ['approval' => false])
            ->assertStatus(403);

        $this->assertSame('adordc', $form->fresh()->stage);
    }

    public function test_a_rejection_with_a_reason_sends_the_form_back(): void
    {
        $form = $this->formAt('adordc');

        $this->submit($this->reviewer('adordc'), $form, [
            'approval' => false,
            'comments' => 'The cognate area does not match the proposal.',
        ])->assertStatus(200);

        $this->assertSame('hod', $form->fresh()->stage, 'a rejection returns the form to the previous step');
    }
}
