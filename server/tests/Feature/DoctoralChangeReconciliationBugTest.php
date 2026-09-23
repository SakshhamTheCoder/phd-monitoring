<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IrbDoctoralApproval;
use App\Models\IrbSubForm;
use App\Models\Presentation;
use App\Models\PresentationReview;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Bug tests for SupervisorDoctoralChangeController::applyDoctoralChange: it
 * writes doctoral_commitee only and never reconciles the approval rows IRB
 * submissions and Presentations seed off the committee at the time. Every test
 * here is EXPECTED TO FAIL until that reconciliation lands - each docblock says
 * so explicitly. When the fix ships, these should start passing with no
 * change to the assertions.
 *
 * Fixture helpers are deliberately duplicated from
 * DoctoralChangeReconciliationPreserveTest rather than shared: each file
 * builds its own scholars, faculty and forms, as this codebase's tests do
 * elsewhere (see ExaminerListOverlapTest::makeStudent).
 */
class DoctoralChangeReconciliationBugTest extends TestCase
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
            'name' => 'Reconciliation Bug Dept ' . $n,
            'code' => 'RCB' . $n,
        ]);
    }

    private function makeUser(string $role): User
    {
        $n = $this->nextTag();
        $roleRow = Role::where('role', $role)->firstOrFail();

        return User::create([
            'first_name' => ucfirst($role),
            'last_name' => 'Fixture ' . $n,
            'email' => $role . '.reconbug' . $n . '@example.invalid',
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

    /** HOD is needed once a form leaves the doctoral stage: the move-on
     * notification reads department->hod->user unguarded. */
    private function makeHod(Department $department): Faculty
    {
        $hod = $this->makeFaculty($this->makeUser('faculty'), $department);
        $department->hod_id = $hod->faculty_code;
        $department->save();

        return $hod;
    }

    private function makeCommitteeMember(Student $student, Department $department): Faculty
    {
        $member = $this->makeFaculty($this->makeUser('faculty'), $department);
        DoctoralCommittee::create([
            'student_id' => $student->roll_no,
            'faculty_id' => $member->faculty_code,
            'type' => 'internal',
        ]);

        return $member;
    }

    private function loginAsRole(User $user, string $role): void
    {
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');
    }

    private function addDoctoralMemberViaAdmin(Student $student, Faculty $newMember): void
    {
        $admin = $this->makeUser('admin');
        $this->loginAsRole($admin, 'admin');

        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'add',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'new_faculty_code' => $newMember->faculty_code,
        ])->assertStatus(201);
    }

    private function removeDoctoralMemberViaAdmin(Student $student, Faculty $member): void
    {
        $admin = $this->makeUser('admin');
        $this->loginAsRole($admin, 'admin');

        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'remove',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'old_faculty_code' => $member->faculty_code,
        ])->assertStatus(201);
    }

    // ------------------------------------------------------------------
    // IRB submission fixtures
    // ------------------------------------------------------------------

    private const IRB_STEPS = ['student', 'faculty', 'external', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];

    /** @param  array<int, Faculty>  $members */
    private function irbSubmissionAtDoctoral(Student $student, Department $department, array $members): IrbSubForm
    {
        $steps = self::IRB_STEPS;
        $form = IrbSubForm::create([
            'student_id' => $student->roll_no,
            'status' => 'pending',
            'completion' => 'incomplete',
            'stage' => 'doctoral',
            'steps' => $steps,
            'current_step' => array_search('doctoral', $steps),
            'maximum_step' => array_search('doctoral', $steps),
            'doctoral_lock' => false,
        ]);

        foreach ($members as $member) {
            IrbDoctoralApproval::create([
                'irb_sub_form_id' => $form->id,
                'doctoral_id' => $member->faculty_code,
                'status' => 'pending',
            ]);
        }

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

        return $form;
    }

    private function submitIrbDoctoral(IrbSubForm $form, Faculty $member, bool $approval = true): \Illuminate\Testing\TestResponse
    {
        $user = User::findOrFail($member->user_id);
        $this->loginAsRole($user, 'doctoral');

        return $this->postJson("/api/forms/irb-submission/{$form->id}", [
            'approval' => $approval,
            'comments' => $approval ? null : 'not satisfactory',
        ]);
    }

    // ------------------------------------------------------------------
    // Presentation fixtures
    // ------------------------------------------------------------------

    private const PRESENTATION_STEPS = ['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'complete'];

    /** @param  array<int, Faculty>  $members */
    private function presentationAtDoctoral(Student $student, array $members): Presentation
    {
        $steps = self::PRESENTATION_STEPS;
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

        foreach ($members as $member) {
            PresentationReview::create([
                'presentation_id' => $form->id,
                'faculty_id' => $member->faculty_code,
                'comments' => '',
                'review_status' => 'pending',
                'is_supervisor' => 0,
            ]);
        }

        return $form;
    }

    private function submitPresentationDoctoral(Presentation $form, Faculty $member, bool $approval = true): \Illuminate\Testing\TestResponse
    {
        $user = User::findOrFail($member->user_id);
        $this->loginAsRole($user, 'doctoral');

        return $this->postJson("/api/presentation/semester/1/{$form->id}", [
            'approval' => $approval,
            'comments' => $approval ? 'satisfactory' : 'not satisfactory',
        ]);
    }

    // ------------------------------------------------------------------
    // B1: IRB, member added after seeding, form becomes unadvanceable.
    // ------------------------------------------------------------------

    /**
     * EXPECTED TO FAIL until applyDoctoralChange reconciles irb_doctoral_approvals.
     *
     * IrbSubController::handleDoctoralSubmitForm keys every step off
     * doctoral_commitee live count vs. approved-row count. A member added
     * after the doctoral stage was seeded has no approval row.
     *
     * Verified against the running code rather than assumed: a missing
     * approval row is not silently skipped. handleDoctoralSubmitForm reads
     * ->status off doctoralApprovals()->first(), which is null for this
     * member, and Laravel's error handler promotes that property-read warning
     * to a thrown ErrorException. So the observable symptom is not a quiet
     * no-op - it is the newly added member getting a 403 with a raw PHP
     * warning as its message every time they try to approve, while the two
     * original members are stuck at "waiting for others" forever because the
     * live count can never reach 3 on only 2 approval rows.
     */
    public function test_irb_member_added_after_seeding_leaves_the_form_stuck(): void
    {
        $department = $this->makeDepartment();
        $this->makeHod($department);
        $student = $this->makeStudent($this->makeUser('student'), $department);

        $first = $this->makeCommitteeMember($student, $department);
        $second = $this->makeCommitteeMember($student, $department);
        $form = $this->irbSubmissionAtDoctoral($student, $department, [$first, $second]);

        $third = $this->makeFaculty($this->makeUser('faculty'), $department);
        $this->addDoctoralMemberViaAdmin($student, $third);
        $this->assertSame(3, $student->fresh()->doctoralCommittee->count());

        $this->submitIrbDoctoral($form, $first)->assertStatus(201);
        $this->submitIrbDoctoral($form, $second)->assertStatus(201);
        $thirdResponse = $this->submitIrbDoctoral($form, $third);

        // The observable symptom: the third member cannot register an
        // approval at all - they get a crash-shaped 403, not even a normal
        // "you're not authorized". Once reconciled, their approval is the
        // third and last the live committee needs, and it should carry the
        // form on to 'phd_coordinator' (the IRB chain's next step) like anyone else's would.
        $thirdResponse->assertStatus(200, 'a committee member in good standing should be able to cast an approval, not crash on a missing row');
        $this->assertSame(
            'phd_coordinator',
            $form->fresh()->stage,
            'once every live committee member (including one added after seeding) has approved, the form should leave the doctoral stage'
        );
        $this->assertSame(
            3,
            IrbDoctoralApproval::where('irb_sub_form_id', $form->id)->count(),
            'a member added after seeding should get an approval row of their own'
        );
    }

    // ------------------------------------------------------------------
    // B2: IRB, member removed after approving, form advances on a minority
    // of the live committee.
    // ------------------------------------------------------------------

    /**
     * EXPECTED TO FAIL until applyDoctoralChange reconciles irb_doctoral_approvals.
     *
     * Removing a member leaves their already-'approved' irb_doctoral_approvals
     * row in place (applyDoctoralChange only touches doctoral_commitee), while
     * the live committee shrinks by one.
     *
     * Verified against the running code rather than assumed, and the result
     * is the opposite of "stuck": the stale approved row and the shrunk live
     * count cancel out, so the very next live member to approve makes
     * approved-count == live-count and the form advances immediately - one
     * live member short of everyone who is actually still on the committee.
     * The member who never got a turn (third) then finds doctoral_lock
     * already true and cannot approve at all. The promise this stage makes
     * (every live member signed off before it moves on) is broken either way;
     * this is the concrete way it breaks here.
     */
    public function test_irb_member_removed_after_approving_lets_the_form_advance_without_every_live_member(): void
    {
        $department = $this->makeDepartment();
        $this->makeHod($department);
        $student = $this->makeStudent($this->makeUser('student'), $department);

        $first = $this->makeCommitteeMember($student, $department);
        $second = $this->makeCommitteeMember($student, $department);
        $third = $this->makeCommitteeMember($student, $department);
        $form = $this->irbSubmissionAtDoctoral($student, $department, [$first, $second, $third]);

        $this->submitIrbDoctoral($form, $first)->assertStatus(201);

        $this->removeDoctoralMemberViaAdmin($student, $first);
        $this->assertSame(2, $student->fresh()->doctoralCommittee->count());

        // second is only one of the two live members left (second, third).
        // Their approval alone must not be enough to complete the stage.
        $this->submitIrbDoctoral($form, $second)->assertStatus(
            201,
            'second is one of two live members; the stale approval from the removed member must not count towards completion'
        );
        $this->assertSame('doctoral', $form->fresh()->stage);

        // Only once third also approves should the stage complete.
        $this->submitIrbDoctoral($form, $third)->assertOk();
        $this->assertSame('phd_coordinator', $form->fresh()->stage);
    }

    // ------------------------------------------------------------------
    // B3: Presentation, member removed before voting, form becomes unadvanceable.
    // ------------------------------------------------------------------

    /**
     * EXPECTED TO FAIL until applyDoctoralChange reconciles presentation_reviews.
     *
     * PresentationController::doctoralSubmit's completion check only asks
     * "are there any pending presentation_reviews left", never comparing
     * against the live committee. Removing a member before they vote leaves
     * their row 'pending' forever: nothing ever updates it (they can no longer
     * reach the form to vote) and nothing ever excludes it from the pending
     * count. Reconciled, removing them should clear their now-meaningless
     * pending row so the two remaining live members can actually finish the
     * stage.
     */
    public function test_presentation_member_removed_before_voting_leaves_an_orphan_pending_row(): void
    {
        $department = $this->makeDepartment();
        $this->makeHod($department);
        $student = $this->makeStudent($this->makeUser('student'), $department);

        $first = $this->makeCommitteeMember($student, $department);
        $second = $this->makeCommitteeMember($student, $department);
        $third = $this->makeCommitteeMember($student, $department);
        $form = $this->presentationAtDoctoral($student, [$first, $second, $third]);

        $this->removeDoctoralMemberViaAdmin($student, $second);

        $this->submitPresentationDoctoral($form, $first);
        $this->submitPresentationDoctoral($form, $third);

        $this->assertFalse(
            PresentationReview::where('presentation_id', $form->id)
                ->where('faculty_id', $second->faculty_code)
                ->where('review_status', 'pending')
                ->exists(),
            "a removed member's pending row must not survive to block completion forever"
        );
        $this->assertSame(
            'hod',
            $form->fresh()->stage,
            'the stage should complete once every live member has approved, unblocked by a removed member\'s stale row'
        );

        // Access is already correctly revoked today (see the preserve test for
        // this); it stays revoked after the fix too.
        $secondUser = User::findOrFail($second->user_id);
        $this->loginAsRole($secondUser, 'doctoral');
        $this->getJson("/api/presentation/semester/1/{$form->id}")->assertStatus(403);
    }

    // ------------------------------------------------------------------
    // B4: Presentation, member added after seeding, vote silently discarded.
    // ------------------------------------------------------------------

    /**
     * EXPECTED TO FAIL until applyDoctoralChange reconciles presentation_reviews.
     *
     * A member added after the doctoral stage was seeded has no
     * presentation_reviews row.
     *
     * Verified against the running code rather than assumed: doctoralSubmit
     * reads ->review_status off PresentationReview::first(), which is null for
     * this member, and that null-property read is promoted to a thrown
     * ErrorException the same way it is in IrbSubController. So the newly
     * added member's own submit crashes with a 403 first, before the "vote is
     * silently discarded" half of the story even gets a chance to run: the
     * doctoralSubmit completion check only counts pending rows, never the live
     * committee, so once the two original members finish, the stage completes
     * without the new member ever having had a working way to vote at all.
     */
    public function test_presentation_member_added_after_seeding_has_no_say(): void
    {
        $department = $this->makeDepartment();
        $this->makeHod($department);
        $student = $this->makeStudent($this->makeUser('student'), $department);

        $first = $this->makeCommitteeMember($student, $department);
        $second = $this->makeCommitteeMember($student, $department);
        $form = $this->presentationAtDoctoral($student, [$first, $second]);

        $third = $this->makeFaculty($this->makeUser('faculty'), $department);
        $this->addDoctoralMemberViaAdmin($student, $third);
        $this->assertSame(3, $student->fresh()->doctoralCommittee->count());

        // Third acts first, before the two original members: reconciled,
        // their approval should register and wait for the rest, exactly like
        // a seeded member's would.
        $thirdResponse = $this->submitPresentationDoctoral($form, $third);
        $thirdResponse->assertStatus(201, 'a newly added committee member should be able to cast an approval and wait for the rest, not crash');
        $this->assertSame(
            1,
            PresentationReview::where('presentation_id', $form->id)
                ->where('faculty_id', $third->faculty_code)->count(),
            'the new member should get a review row of their own to vote through'
        );

        $this->submitPresentationDoctoral($form, $first);
        $this->submitPresentationDoctoral($form, $second);

        // The step must only complete once all three live members --
        // including the one added after seeding -- have actually voted.
        $this->assertSame(
            'hod',
            $form->fresh()->stage,
            'the third member already voted, so the stage should complete once the other two do too'
        );
    }
}
