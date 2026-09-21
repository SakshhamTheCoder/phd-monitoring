<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\Course;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\Role;
use App\Models\Student;
use App\Models\StudentCourse;
use App\Models\SynopsisChecklistOption;
use App\Models\SynopsisChecklistRule;
use App\Models\SynopsisSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The synopsis is the one form the same people approve twice.
 *
 * Round one is the written submission. The viva then happens offline, and round
 * two is the confirmation of it, starting with the coordinator uploading the
 * minutes. The row stores one chain, because `current_step` and `maximum_step`
 * are indices into it; the round is what decides where an approval goes next.
 *
 * That is the part worth a test: everything else on this form is a
 * recommendation, and a mistake in the round leaves a form nobody can move.
 */
class SynopsisVivaRoundTest extends TestCase
{
    use DatabaseTransactions;

    private const CHAIN = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc', 'complete'];

    private Department $department;
    private Student $scholar;
    private User $scholarUser;
    private Faculty $supervisor;
    private User $supervisorUser;
    private User $committeeUser;
    private User $coordinatorUser;
    private User $headUser;
    private User $dordcUser;
    private int $nextFacultyCode = 991700;

    protected function setUp(): void
    {
        parent::setUp();
        AppSetting::forgetCache();

        $this->department = Department::firstOrCreate(
            ['code' => 'SYNT'],
            ['name' => 'Synopsis Test Department']
        );

        $this->scholarUser = $this->userAs('student');
        $this->scholar = Student::create([
            'roll_no' => 991501,
            'user_id' => $this->scholarUser->id,
            'department_id' => $this->department->id,
            'date_of_registration' => '2023-08-01',
            'current_status' => 'full-time',
            'overall_progress' => 10,
        ]);

        $this->supervisorUser = $this->userAs('faculty');
        $this->supervisor = $this->facultyFor($this->supervisorUser);
        DB::table('supervisors')->insert([
            'student_id' => $this->scholar->roll_no,
            'faculty_id' => $this->supervisor->faculty_code,
        ]);

        // A committee member signs in holding 'faculty'; membership is what puts
        // them on the doctoral step.
        $this->committeeUser = $this->userAs('faculty');
        $committee = $this->facultyFor($this->committeeUser);
        DB::table('doctoral_commitee')->insert([
            'student_id' => $this->scholar->roll_no,
            'faculty_id' => $committee->faculty_code,
        ]);

        $this->coordinatorUser = $this->userAs('phd_coordinator');
        $coordinator = $this->facultyFor($this->coordinatorUser);
        DB::table('phd_coordinators')->insert([
            'department_id' => $this->department->id,
            'faculty_id' => $coordinator->faculty_code,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->headUser = $this->userAs('hod');
        $head = $this->facultyFor($this->headUser);
        $this->department->forceFill(['hod_id' => $head->faculty_code])->save();

        $this->dordcUser = $this->userAs('dordc');
        $this->facultyFor($this->dordcUser);
    }

    private function userAs(string $role): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);

        $user = new User();
        $user->forceFill([
            'first_name' => 'Syn',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@syn.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function facultyFor(User $user): Faculty
    {
        return Faculty::create([
            'faculty_code' => $this->nextFacultyCode++,
            'user_id' => $user->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);
    }

    /** A form parked at a stage, on a given round, with everything behind it answered. */
    private function formAt(string $stage, int $round = 1): SynopsisSubmission
    {
        $form = SynopsisSubmission::create([
            'student_id' => $this->scholar->roll_no,
            'status' => 'pending',
            'stage' => $stage,
            'round' => $round,
            'steps' => self::CHAIN,
            'current_progress' => 20,
            'total_progress' => 30,
            'student_lock' => true,
            'supervisor_lock' => $stage === 'supervisor' ? false : true,
            'doctoral_lock' => $stage === 'doctoral' ? false : true,
            'phd_coordinator_lock' => $stage === 'phd_coordinator' ? false : true,
            'hod_lock' => $stage === 'hod' ? false : true,
            'dordc_lock' => $stage === 'dordc' ? false : true,
        ]);

        Forms::updateOrCreate(
            ['form_type' => 'synopsis-submission', 'student_id' => $this->scholar->roll_no],
            [
                'form_name' => 'Synopsis Submission',
                'department_id' => $this->department->id,
                'stage' => $stage,
                'max_count' => 1,
                'count' => 1,
                'steps' => self::CHAIN,
            ]
        );

        return $form;
    }

    private function submit(User $user, SynopsisSubmission $form, array $body)
    {
        return $this->actingAs($user, 'sanctum')
            ->postJson('/api/forms/synopsis-submission/' . $form->id, $body);
    }

    private function approve(User $user, SynopsisSubmission $form)
    {
        return $this->submit($user, $form, ['approval' => true, 'comments' => 'Fine']);
    }

    // ------------------------------------------------------------ round one

    public function test_the_written_round_runs_student_supervisor_doctoral_coordinator_hod_dordc(): void
    {
        $form = $this->formAt('supervisor');

        // The supervisor's panel scores the progress on the written round, and
        // current_progress is not nullable, so the panel always sends it.
        $this->submit($this->supervisorUser, $form, [
            'approval' => true,
            'comments' => 'Fine',
            'current_progress' => 20,
        ])->assertStatus(200);
        $this->assertSame('doctoral', $form->fresh()->stage);

        $this->approve($this->committeeUser, $form)->assertStatus(200);
        $this->assertSame('phd_coordinator', $form->fresh()->stage);

        $this->approve($this->coordinatorUser, $form)->assertStatus(200);
        $this->assertSame('hod', $form->fresh()->stage);

        $this->approve($this->headUser, $form)->assertStatus(200);
        $this->assertSame('dordc', $form->fresh()->stage);
    }

    public function test_the_dordc_does_not_complete_the_written_round_but_opens_the_viva(): void
    {
        $form = $this->formAt('dordc');

        $this->approve($this->dordcUser, $form)->assertStatus(200);

        $form = $form->fresh();
        $this->assertSame(2, (int) $form->round, 'approving the written round starts the viva round');
        $this->assertSame('phd_coordinator', $form->stage, 'the viva round starts with the coordinator');
        $this->assertNotSame('complete', $form->completion, 'the synopsis is not finished until after the viva');

        // The people who confirm after the viva have to be able to answer again.
        foreach (['supervisor', 'doctoral', 'hod'] as $role) {
            $this->assertFalse((bool) $form->{$role . '_lock'}, $role . ' has to answer again after the viva');
        }
    }

    // ------------------------------------------------------------ round two

    public function test_the_coordinator_cannot_open_the_viva_round_without_the_minutes(): void
    {
        $form = $this->formAt('phd_coordinator', 2);

        $this->approve($this->coordinatorUser, $form)->assertStatus(422);
        $this->assertSame('phd_coordinator', $form->fresh()->stage, 'a refused submission must not move the form');
    }

    public function test_the_viva_round_runs_coordinator_supervisor_doctoral_hod_dordc_and_completes(): void
    {
        Storage::fake('local');
        $form = $this->formAt('phd_coordinator', 2);

        $this->actingAs($this->coordinatorUser, 'sanctum')
            ->post('/api/forms/synopsis-submission/' . $form->id, [
                'approval' => true,
                'comments' => 'Viva held',
                'viva_minutes_pdf' => UploadedFile::fake()->create('minutes.pdf', 12, 'application/pdf'),
            ])->assertStatus(200);

        $form = $form->fresh();
        $this->assertNotNull($form->viva_minutes_pdf, 'the minutes are the record that the viva happened');
        $this->assertSame('supervisor', $form->stage, 'the coordinator hands the viva round to the supervisor');

        $this->approve($this->supervisorUser, $form)->assertStatus(200);
        $this->assertSame('doctoral', $form->fresh()->stage);

        $this->approve($this->committeeUser, $form)->assertStatus(200);
        $this->assertSame('hod', $form->fresh()->stage);

        $this->approve($this->headUser, $form)->assertStatus(200);
        $this->assertSame('dordc', $form->fresh()->stage);

        $this->approve($this->dordcUser, $form)->assertStatus(200);

        $form = $form->fresh();
        $this->assertSame('complete', $form->completion, 'the DORDC finishes the synopsis after the viva');
        $this->assertSame(30, (int) $this->scholar->fresh()->overall_progress);
    }

    public function test_a_rejection_in_the_viva_round_goes_back_one_step_of_that_round(): void
    {
        $form = $this->formAt('hod', 2);

        $this->submit($this->headUser, $form, ['approval' => false, 'comments' => 'The minutes are unsigned.'])
            ->assertStatus(200);

        // Round two is coordinator, supervisor, doctoral, HOD, DORDC, so the step
        // before the HOD is the doctoral committee, not the coordinator as it is
        // in round one.
        $this->assertSame('doctoral', $form->fresh()->stage);
    }

    // ------------------------------------------------------- the credit gate

    public function test_the_synopsis_cannot_be_raised_before_the_coursework_is_done(): void
    {
        $this->markTestSkipped(
            'The coursework gate is commented out in SynopsisSubmissionController until the '
            . 'UGC and regular course types are settled and completedCredits() splits in two. '
            . 'Unskip with it.'
        );

        AppSetting::put('coursework', 'min_credits_full_time', 12);
        $this->giveCredits(8);
        $this->openSynopsisFor($this->scholar);

        $this->actingAs($this->scholarUser, 'sanctum')
            ->postJson('/api/forms/synopsis-submission')
            ->assertStatus(400);

        $this->assertSame(0, SynopsisSubmission::where('student_id', $this->scholar->roll_no)->count());
    }

    /**
     * Still meaningful with the gate off: it pins that the form opens at all,
     * on the right chain and the right round.
     */
    public function test_the_synopsis_opens_once_the_credits_are_there(): void
    {
        AppSetting::put('coursework', 'min_credits_full_time', 12);
        $this->giveCredits(12);
        $this->openSynopsisFor($this->scholar);

        $this->actingAs($this->scholarUser, 'sanctum')
            ->postJson('/api/forms/synopsis-submission')
            ->assertStatus(200);

        $form = SynopsisSubmission::where('student_id', $this->scholar->roll_no)->first();
        $this->assertNotNull($form);
        $this->assertSame(self::CHAIN, $form->steps);
        $this->assertSame(1, (int) $form->round);
    }

    // --------------------------------------------------------- the checklist

    /**
     * The scholar is in the test department and registered on 2023-08-01, so a
     * departmentless clause and a date clause covering 2023 both apply, and the
     * two lists merge in rule order.
     */
    public function test_the_checklist_merges_every_condition_the_scholar_meets(): void
    {
        $general = $this->ruleFor('All other departments', ['sort_order' => 1]);
        $dated = $this->ruleFor('Admitted July 2018 to July 2025', [
            'sort_order' => 2,
            'admitted_from' => '2018-07-01',
            'admitted_to' => '2025-07-31',
        ]);
        $older = $this->ruleFor('Admitted before July 2018', [
            'sort_order' => 3,
            'admitted_to' => '2018-06-30',
        ]);

        $this->optionOn($general, 'Two SCIE articles and one conference paper', 1);
        $this->optionOn($general, 'Withdrawn wording', 2, false);
        $this->optionOn($dated, 'Three SCI publications', 1);
        $this->optionOn($older, 'Two SCI publications', 1);

        $labels = SynopsisChecklistOption::forStudent($this->scholar)->pluck('label')->all();

        $this->assertSame(
            ['Two SCIE articles and one conference paper', 'Three SCI publications'],
            $labels
        );
    }

    /**
     * A department with a complete set of its own answers on its own: the
     * clauses everyone else reads, including the date ones, stay out.
     */
    public function test_an_exclusive_department_is_offered_nothing_else(): void
    {
        $general = $this->ruleFor('All other departments', ['sort_order' => 1]);
        $dated = $this->ruleFor('Admitted July 2018 to July 2025', [
            'sort_order' => 2,
            'admitted_from' => '2018-07-01',
            'admitted_to' => '2025-07-31',
        ]);
        $own = $this->ruleFor('LMTSM', [
            'sort_order' => 3,
            'department_ids' => [$this->department->id],
            'exclusive' => true,
        ]);

        $this->optionOn($general, 'Two SCIE articles and one conference paper', 1);
        $this->optionOn($dated, 'Three SCI publications', 1);
        $this->optionOn($own, 'One paper in the ABDC list, category B/A/A*/FT-50', 1);
        $this->optionOn($own, 'Two papers in a Scopus journal in Q1/Q2', 2);

        $labels = SynopsisChecklistOption::forStudent($this->scholar)->pluck('label')->all();

        $this->assertSame(
            ['One paper in the ABDC list, category B/A/A*/FT-50', 'Two papers in a Scopus journal in Q1/Q2'],
            $labels
        );
    }

    /**
     * A department whose own rules changed on a date is two conditions, each
     * with its own window. The windows are what keeps them apart: two
     * conditions that stand alone and both match would merge with each other.
     */
    public function test_one_department_can_hold_a_condition_per_admission_window(): void
    {
        $older = $this->ruleFor('Humanities, admitted before July 2018', [
            'sort_order' => 1,
            'department_ids' => [$this->department->id],
            'admitted_to' => '2018-06-30',
            'exclusive' => true,
        ]);
        $current = $this->ruleFor('Humanities, admitted from July 2018', [
            'sort_order' => 2,
            'department_ids' => [$this->department->id],
            'admitted_from' => '2018-07-01',
            'exclusive' => true,
        ]);

        $this->optionOn($older, 'One paper in the ABDC list, category A', 1);
        $this->optionOn($current, 'One paper in the ABDC list, category B/A/A*', 1);

        // The scholar registered on 2023-08-01.
        $this->assertSame(
            ['One paper in the ABDC list, category B/A/A*'],
            SynopsisChecklistOption::forStudent($this->scholar)->pluck('label')->all()
        );

        $this->scholar->forceFill(['date_of_registration' => '2016-08-01'])->save();

        $this->assertSame(
            ['One paper in the ABDC list, category A'],
            SynopsisChecklistOption::forStudent($this->scholar->fresh())->pluck('label')->all()
        );
    }

    /** A condition for other departments only does not reach this scholar. */
    public function test_a_condition_for_other_departments_is_not_offered(): void
    {
        $elsewhere = Department::firstOrCreate(['code' => 'SYNX'], ['name' => 'Another Department']);
        $rule = $this->ruleFor('Humanities', ['department_ids' => [$elsewhere->id]]);
        $this->optionOn($rule, 'One paper in the ABDC list', 1);

        $this->assertTrue(SynopsisChecklistOption::forStudent($this->scholar)->isEmpty());
    }

    /** The category is the supervisor's declaration, and round one will not move without it. */
    public function test_the_supervisor_declares_the_category_on_the_written_round(): void
    {
        $rule = $this->ruleFor('All other departments');
        $this->optionOn($rule, 'Two SCIE articles and one conference paper', 1);
        $chosen = $this->optionOn($rule, 'Three SCI publications', 2);

        $form = $this->formAt('supervisor');

        $this->submit($this->supervisorUser, $form, [
            'approval' => true,
            'comments' => 'Fine',
            'current_progress' => 20,
        ])->assertStatus(422);
        $this->assertSame('supervisor', $form->fresh()->stage, 'an undeclared category must not move the form');

        $this->submit($this->supervisorUser, $form, [
            'approval' => true,
            'comments' => 'Fine',
            'current_progress' => 20,
            'checklist_option_id' => $chosen->id,
        ])->assertStatus(200);

        $form = $form->fresh();
        $this->assertSame('doctoral', $form->stage);
        $this->assertSame($chosen->id, (int) $form->checklist_option_id);
    }

    /** Sending the form back is a request for a correction, not a declaration. */
    public function test_sending_the_synopsis_back_needs_no_category(): void
    {
        $rule = $this->ruleFor('All other departments');
        $this->optionOn($rule, 'Three SCI publications', 1);

        $form = $this->formAt('supervisor');

        $this->submit($this->supervisorUser, $form, [
            'approval' => false,
            'comments' => 'Rework the objectives',
            'current_progress' => 20,
        ])->assertStatus(200);

        $this->assertSame('student', $form->fresh()->stage);
    }

    private function ruleFor(string $name, array $attributes = []): SynopsisChecklistRule
    {
        return SynopsisChecklistRule::create(array_merge(['name' => $name], $attributes));
    }

    private function optionOn(SynopsisChecklistRule $rule, string $label, int $order, bool $active = true): SynopsisChecklistOption
    {
        return SynopsisChecklistOption::create([
            'rule_id' => $rule->id,
            'label' => $label,
            'sort_order' => $order,
            'active' => $active,
        ]);
    }

    private function giveCredits(float $credits): void
    {
        $course = Course::create([
            'course_code' => 'SYN' . Str::upper(Str::random(4)),
            'course_name' => 'Research Methodology',
            'credits' => $credits,
            'department_id' => $this->department->id,
        ]);

        StudentCourse::create([
            'student_id' => $this->scholar->roll_no,
            'course_id' => $course->id,
            'status' => 'completed',
            'semester' => '2024-1',
        ]);
    }

    /** createForms() refuses unless the scholar's forms row offers the step. */
    private function openSynopsisFor(Student $scholar): void
    {
        Forms::updateOrCreate(
            ['form_type' => 'synopsis-submission', 'student_id' => $scholar->roll_no],
            [
                'form_name' => 'Synopsis Submission',
                'department_id' => $this->department->id,
                'stage' => 'student',
                'max_count' => 1,
                'count' => 0,
                'student_available' => true,
                'steps' => self::CHAIN,
            ]
        );
    }
}
