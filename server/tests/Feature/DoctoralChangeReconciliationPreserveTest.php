<?php

namespace Tests\Feature;

use App\Models\ConstituteOfIRB;
use App\Models\Department;
use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IRBCommittee;
use App\Models\IrbExpertChairman;
use App\Models\IrbNomineeCognate;
use App\Models\IrbOutsideExpert;
use App\Models\OutsideExpert;
use App\Models\Presentation;
use App\Models\PresentationReview;
use App\Models\PhdCoordinator;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Characterisation tests for SupervisorDoctoralChangeController::applyDoctoralChange
 * and the two forms that seed approval rows off the committee (IRB submission,
 * Presentation), written before applyDoctoralChange is changed to reconcile
 * those seeded rows. Everything here must hold both before and after that fix:
 * it is the safety net, not the thing being changed.
 *
 * Every fixture is built fresh in each test (own department, faculty, student).
 * Reaching into whatever the dev database happens to already contain, keyed on
 * row order, is what broke ClerkLeaveTest and AdordcStudentUpdateScopeTest for
 * months; nothing here repeats that.
 */
class DoctoralChangeReconciliationPreserveTest extends TestCase
{
    use DatabaseTransactions;

    private int $tag = 0;

    private function nextTag(): int
    {
        return ++$this->tag;
    }

    private function makeDepartment(): Department
    {
        $n = $this->nextTag();
        return Department::create([
            'name' => 'Reconciliation Dept ' . $n,
            'code' => 'RCP' . $n,
        ]);
    }

    private function makeUser(string $role): User
    {
        $n = $this->nextTag();
        $roleRow = Role::where('role', $role)->firstOrFail();

        return User::create([
            'first_name' => ucfirst($role),
            'last_name' => 'Fixture ' . $n,
            'email' => $role . '.recon' . $n . '@example.invalid',
            'password' => bcrypt('not-used'),
            'role_id' => $roleRow->id,
            'current_role_id' => $roleRow->id,
            'status' => 'active',
        ]);
    }

    private function makeFaculty(User $user, Department $department): Faculty
    {
        return Faculty::create([
            'faculty_code' => (int) Faculty::max('faculty_code') + 1,
            'user_id' => $user->id,
            'designation' => 'Professor',
            'department_id' => $department->id,
        ]);
    }

    private function makeStudent(User $user, Department $department): Student
    {
        return Student::create([
            'roll_no' => (int) Student::max('roll_no') + 1,
            'user_id' => $user->id,
            'department_id' => $department->id,
            'date_of_registration' => now()->subYear()->toDateString(),
            'current_status' => 'full-time',
            'overall_progress' => 0,
        ]);
    }

    /**
     * A faculty member with a login, made HOD of the department.
     *
     * Advancing a form off the doctoral stage notifies the next stage's role
     * (sendHodNotification reads department->hod->user unguarded), so any test
     * that lets a doctoral submission succeed needs a real HOD in place or that
     * notification step throws on a null department->hod.
     */
    private function makeHod(Department $department): Faculty
    {
        $hod = $this->makeFaculty($this->makeUser('faculty'), $department);
        $department->hod_id = $hod->faculty_code;
        $department->save();

        return $hod;
    }

    /** A faculty member with a login, seated on the committee. */
    private function makeCommitteeMember(Student $student, Department $department, string $type = 'internal'): Faculty
    {
        $member = $this->makeFaculty($this->makeUser('faculty'), $department);
        DoctoralCommittee::create([
            'student_id' => $student->roll_no,
            'faculty_id' => $member->faculty_code,
            'type' => $type,
        ]);

        return $member;
    }

    private function loginAsRole(User $user, string $role): void
    {
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');
    }

    // ------------------------------------------------------------------
    // 1. dordcSubmit on IRB Constitution seeds doctoral_commitee, firstOrCreate
    // ------------------------------------------------------------------

    public function test_irb_constitution_dordc_submit_seeds_doctoral_committee_with_internal_type(): void
    {
        $department = $this->makeDepartment();
        $student = $this->makeStudent($this->makeUser('student'), $department);

        // The cognate expert already sits on the committee (e.g. nominated twice
        // across revisions) so firstOrCreate's no-op path is actually exercised,
        // not just its happy path.
        $cognate = $this->makeFaculty($this->makeUser('faculty'), $department);
        DoctoralCommittee::create([
            'student_id' => $student->roll_no,
            'faculty_id' => $cognate->faculty_code,
            'type' => 'internal',
        ]);

        $chairman = $this->makeFaculty($this->makeUser('faculty'), $department);
        $outsideExpert = OutsideExpert::create([
            'first_name' => 'Outside',
            'last_name' => 'Reviewer',
            'designation' => 'Professor',
            'institution' => 'Elsewhere University',
            'department' => 'CSE',
            'email' => 'outside.reviewer.' . $this->nextTag() . '@example.invalid',
        ]);

        $steps = ['student', 'faculty', 'hod', 'adordc', 'dordc', 'complete'];
        $form = ConstituteOfIRB::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'dordc',
            'steps' => $steps,
            'current_step' => array_search('dordc', $steps),
            'maximum_step' => array_search('dordc', $steps),
            'dordc_lock' => false,
        ]);

        IrbOutsideExpert::create(['irb_form_id' => $form->id, 'expert_id' => $outsideExpert->id]);
        IrbNomineeCognate::create([
            'irb_form_id' => $form->id,
            'supervisor_id' => null,
            'nominee_id' => $cognate->faculty_code,
            'status' => 'awaited',
        ]);
        IrbExpertChairman::create(['irb_form_id' => $form->id, 'expert_id' => $chairman->faculty_code]);

        Forms::create([
            'student_id' => $student->roll_no,
            'form_type' => 'irb-constitution',
            'form_name' => 'IRB Constitution',
            'department_id' => $department->id,
            'steps' => $steps,
            'stage' => 'dordc',
            'max_level' => count($steps) - 1,
            'current_level' => array_search('dordc', $steps),
            'count' => 1,
            'max_count' => 1,
            'dordc_available' => true,
        ]);

        $dordc = $this->makeUser('dordc');
        $this->loginAsRole($dordc, 'dordc');

        $response = $this->postJson("/api/forms/irb-constitution/{$form->id}", [
            'approval' => true,
            'comments' => 'constituted',
            'outside_expert' => $outsideExpert->id,
            'cognate_expert' => $cognate->faculty_code,
        ]);

        $response->assertOk();

        // firstOrCreate on the cognate is a no-op: still exactly one row, not a
        // duplicate-key error and not two rows.
        $this->assertSame(
            1,
            DoctoralCommittee::where('student_id', $student->roll_no)
                ->where('faculty_id', $cognate->faculty_code)->count()
        );
        $this->assertDatabaseHas('doctoral_commitee', [
            'student_id' => $student->roll_no,
            'faculty_id' => $cognate->faculty_code,
            'type' => 'internal',
        ]);

        // The chairman expert is newly seeded, also typed internal.
        $this->assertDatabaseHas('doctoral_commitee', [
            'student_id' => $student->roll_no,
            'faculty_id' => $chairman->faculty_code,
            'type' => 'internal',
        ]);
    }

    // ------------------------------------------------------------------
    // 2 & 3. A committee member can act on the doctoral step of Presentation
    // and IRB submission regardless of their doctoral_commitee.type.
    // ------------------------------------------------------------------

    public function test_a_committee_member_can_act_on_the_presentation_doctoral_step_regardless_of_type(): void
    {
        $department = $this->makeDepartment();
        $this->makeHod($department);
        $student = $this->makeStudent($this->makeUser('student'), $department);

        // type is 'external', which checkDoctoralCommittee does not filter on.
        $member = $this->makeCommitteeMember($student, $department, 'external');

        $steps = ['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];
        $form = Presentation::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'doctoral',
            'steps' => $steps,
            'current_step' => array_search('doctoral', $steps),
            'maximum_step' => array_search('doctoral', $steps),
            'doctoral_lock' => false,
            'period_of_report' => 'Jan-Jun 2026',
        ]);
        PresentationReview::create([
            'presentation_id' => $form->id,
            'faculty_id' => $member->faculty_code,
            'comments' => '',
            'review_status' => 'pending',
            'is_supervisor' => 0,
        ]);

        $memberUser = User::findOrFail($member->user_id);
        $this->loginAsRole($memberUser, 'doctoral');

        $this->getJson("/api/presentation/semester/1/{$form->id}")->assertOk();

        // Solo member, so their approval alone satisfies the pending count and
        // the form leaves the doctoral stage.
        $this->postJson("/api/presentation/semester/1/{$form->id}", [
            'approval' => true,
            'comments' => 'satisfactory',
        ])->assertOk();

        $this->assertSame('hod', $form->fresh()->stage);
    }

    public function test_a_committee_member_can_act_on_the_irb_submission_doctoral_step_regardless_of_type(): void
    {
        $department = $this->makeDepartment();
        $this->makeHod($department);
        $student = $this->makeStudent($this->makeUser('student'), $department);

        $member = $this->makeCommitteeMember($student, $department, 'external');

        $steps = ['student', 'faculty', 'external', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];
        $form = \App\Models\IrbSubForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'doctoral',
            'steps' => $steps,
            'current_step' => array_search('doctoral', $steps),
            'maximum_step' => array_search('doctoral', $steps),
            'doctoral_lock' => false,
        ]);
        \App\Models\IrbDoctoralApproval::create([
            'irb_sub_form_id' => $form->id,
            'doctoral_id' => $member->faculty_code,
            'status' => 'pending',
        ]);
        Forms::create([
            'student_id' => $student->roll_no,
            'form_type' => 'irb-submission',
            'form_name' => 'Revised IRB',
            'department_id' => $department->id,
            'steps' => $steps,
            'stage' => 'doctoral',
            'max_level' => count($steps) - 1,
            'current_level' => array_search('doctoral', $steps),
            'count' => 1,
            'max_count' => 1,
            'doctoral_available' => true,
        ]);

        $memberUser = User::findOrFail($member->user_id);
        $this->loginAsRole($memberUser, 'doctoral');

        $this->getJson("/api/forms/irb-submission/{$form->id}")->assertOk();

        $this->postJson("/api/forms/irb-submission/{$form->id}", [
            'approval' => true,
            'comments' => 'approved',
        ])->assertOk();

        $this->assertSame('hod', $form->fresh()->stage);
    }

    // ------------------------------------------------------------------
    // 4. admin, doctoral and dordc apply a change immediately.
    // ------------------------------------------------------------------

    private function assertProposeAppliesImmediately(string $role): void
    {
        $department = $this->makeDepartment();
        $student = $this->makeStudent($this->makeUser('student'), $department);
        $newMember = $this->makeFaculty($this->makeUser('faculty'), $department);

        $actorUser = $this->makeUser($role === 'doctoral' ? 'faculty' : $role);
        $actorFaculty = $this->makeFaculty($actorUser, $department);
        if ($role === 'doctoral') {
            // A committee seat is required for the doctoral-role scope check.
            DoctoralCommittee::create([
                'student_id' => $student->roll_no,
                'faculty_id' => $actorFaculty->faculty_code,
                'type' => 'internal',
            ]);
        }
        $this->loginAsRole($actorUser, $role);

        $response = $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'add',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'new_faculty_code' => $newMember->faculty_code,
        ]);

        $response->assertStatus(201);
        $this->assertSame('approved', $response->json('data.status'));
        $this->assertDatabaseHas('doctoral_commitee', [
            'student_id' => $student->roll_no,
            'faculty_id' => $newMember->faculty_code,
        ]);
    }

    public function test_admin_applies_a_doctoral_change_immediately(): void
    {
        $this->assertProposeAppliesImmediately('admin');
    }

    public function test_dordc_applies_a_doctoral_change_immediately(): void
    {
        $this->assertProposeAppliesImmediately('dordc');
    }

    public function test_a_doctoral_committee_member_applies_a_change_immediately(): void
    {
        $this->assertProposeAppliesImmediately('doctoral');
    }

    // ------------------------------------------------------------------
    // 5. hod and phd_coordinator create a pending row, needing approveChange.
    // ------------------------------------------------------------------

    private function assertProposeIsQueuedPending(string $role): User
    {
        $department = $this->makeDepartment();
        $student = $this->makeStudent($this->makeUser('student'), $department);
        $newMember = $this->makeFaculty($this->makeUser('faculty'), $department);

        $actorUser = $this->makeUser('faculty');
        $actorFaculty = $this->makeFaculty($actorUser, $department);

        if ($role === 'hod') {
            $department->hod_id = $actorFaculty->faculty_code;
            $department->save();
        } else {
            PhdCoordinator::create([
                'department_id' => $department->id,
                'faculty_id' => $actorFaculty->faculty_code,
            ]);
        }
        $this->loginAsRole($actorUser, $role);

        $response = $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'add',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'new_faculty_code' => $newMember->faculty_code,
        ]);

        $response->assertStatus(201);
        $this->assertSame('pending', $response->json('data.status'));
        $this->assertDatabaseMissing('doctoral_commitee', [
            'student_id' => $student->roll_no,
            'faculty_id' => $newMember->faculty_code,
        ]);

        $changeId = $response->json('data.id');

        $dordc = $this->makeUser('dordc');
        $this->loginAsRole($dordc, 'dordc');
        $this->putJson("/api/supervisor-doctoral-changes/approve/{$changeId}")->assertOk();

        $this->assertDatabaseHas('doctoral_commitee', [
            'student_id' => $student->roll_no,
            'faculty_id' => $newMember->faculty_code,
        ]);

        return $actorUser;
    }

    public function test_hod_change_is_queued_pending_and_needs_dordc_approval(): void
    {
        $this->assertProposeIsQueuedPending('hod');
    }

    public function test_phd_coordinator_change_is_queued_pending_and_needs_dordc_approval(): void
    {
        $this->assertProposeIsQueuedPending('phd_coordinator');
    }

    // ------------------------------------------------------------------
    // 6. Scope: doctoral to their own committee, hod to their own department.
    // ------------------------------------------------------------------

    public function test_a_doctoral_committee_member_may_not_propose_for_a_scholar_off_their_committee(): void
    {
        $department = $this->makeDepartment();
        $ownStudent = $this->makeStudent($this->makeUser('student'), $department);
        $strangerStudent = $this->makeStudent($this->makeUser('student'), $department);

        $memberUser = $this->makeUser('faculty');
        $member = $this->makeFaculty($memberUser, $department);
        DoctoralCommittee::create([
            'student_id' => $ownStudent->roll_no,
            'faculty_id' => $member->faculty_code,
            'type' => 'internal',
        ]);
        // Not seated on strangerStudent's committee.

        $this->loginAsRole($memberUser, 'doctoral');

        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $strangerStudent->roll_no,
            'change_type' => 'remove',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'old_faculty_code' => $member->faculty_code,
        ])->assertStatus(403);

        // Their own committee is untouched by the refused attempt.
        $this->assertDatabaseHas('doctoral_commitee', [
            'student_id' => $ownStudent->roll_no,
            'faculty_id' => $member->faculty_code,
        ]);
    }

    public function test_hod_may_not_propose_for_a_student_outside_their_department(): void
    {
        $ownDepartment = $this->makeDepartment();
        $otherDepartment = $this->makeDepartment();
        $outsideStudent = $this->makeStudent($this->makeUser('student'), $otherDepartment);
        $newMember = $this->makeFaculty($this->makeUser('faculty'), $otherDepartment);

        $hodUser = $this->makeUser('faculty');
        $hodFaculty = $this->makeFaculty($hodUser, $ownDepartment);
        $ownDepartment->hod_id = $hodFaculty->faculty_code;
        $ownDepartment->save();

        $this->loginAsRole($hodUser, 'hod');

        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $outsideStudent->roll_no,
            'change_type' => 'add',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'new_faculty_code' => $newMember->faculty_code,
        ])->assertStatus(403);
    }

    // ------------------------------------------------------------------
    // 7. Student::outsideExpert() reads irb_committees(type=outside) only.
    // ------------------------------------------------------------------

    public function test_outside_expert_is_unaffected_by_doctoral_committee_changes(): void
    {
        $department = $this->makeDepartment();
        $student = $this->makeStudent($this->makeUser('student'), $department);

        $expert = OutsideExpert::create([
            'first_name' => 'External',
            'last_name' => 'Assessor',
            'designation' => 'Professor',
            'institution' => 'Faraway Institute',
            'department' => 'ECE',
            'email' => 'external.assessor.' . $this->nextTag() . '@example.invalid',
        ]);
        IRBCommittee::create([
            'student_id' => $student->roll_no,
            'type' => 'outside',
            'member_type' => OutsideExpert::class,
            'member_id' => $expert->id,
        ]);

        $committeeMember = $this->makeCommitteeMember($student, $department);
        $this->assertSame($expert->email, $student->outsideExpert()->email);

        // Changing doctoral_commitee has nothing to do with who the outside
        // expert is.
        DoctoralCommittee::where('student_id', $student->roll_no)
            ->where('faculty_id', $committeeMember->faculty_code)->delete();
        $another = $this->makeCommitteeMember($student, $department);

        $this->assertSame($expert->email, $student->fresh()->outsideExpert()->email);
    }

    // ------------------------------------------------------------------
    // 8. Removing a member removes their access.
    // ------------------------------------------------------------------

    public function test_removing_a_committee_member_revokes_their_form_access(): void
    {
        $department = $this->makeDepartment();
        $student = $this->makeStudent($this->makeUser('student'), $department);
        $member = $this->makeCommitteeMember($student, $department);

        $steps = ['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];
        $form = Presentation::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'doctoral',
            'steps' => $steps,
            'current_step' => array_search('doctoral', $steps),
            'maximum_step' => array_search('doctoral', $steps),
            'doctoral_lock' => false,
            'period_of_report' => 'Jan-Jun 2026',
        ]);
        PresentationReview::create([
            'presentation_id' => $form->id,
            'faculty_id' => $member->faculty_code,
            'comments' => '',
            'review_status' => 'pending',
            'is_supervisor' => 0,
        ]);

        $memberUser = User::findOrFail($member->user_id);
        $this->loginAsRole($memberUser, 'doctoral');
        $this->getJson("/api/presentation/semester/1/{$form->id}")->assertOk();

        $admin = $this->makeUser('admin');
        $this->loginAsRole($admin, 'admin');
        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'remove',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'old_faculty_code' => $member->faculty_code,
        ])->assertStatus(201);

        $this->assertFalse($student->fresh()->checkDoctoralCommittee($member->faculty_code));

        $this->loginAsRole($memberUser, 'doctoral');
        $this->getJson("/api/presentation/semester/1/{$form->id}")->assertStatus(403);
    }
}
