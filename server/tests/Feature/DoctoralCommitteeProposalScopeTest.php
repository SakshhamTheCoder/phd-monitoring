<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Every faculty-shaped account carries the 'doctoral' role in User::ROLE_GRANTS,
 * and RoleRequirements only checked for a Faculty record to allow the switch,
 * so before this fix any faculty member could switch into "Doctoral Committee"
 * and propose a supervisor or committee change for any scholar, not just one
 * they actually sit on. can_propose_supervisor_changes alone does not catch
 * this: doctoral holds that capability institute-wide, so the committee
 * membership check inside proposeChange is the only thing standing between a
 * self-elevated faculty member and any scholar's supervisor record. That is
 * what this test targets, not the capability gate itself.
 */
class DoctoralCommitteeProposalScopeTest extends TestCase
{
    use DatabaseTransactions;

    /** A student with a doctoral committee member who has a login. */
    private function studentWithCommittee(): array
    {
        $student = Student::query()->get()->first(
            fn ($s) => $s->doctoralCommittee->contains(fn ($f) => $f->user_id !== null)
        );

        if (!$student) {
            $this->markTestSkipped('No student in this database has a doctoral committee member with a login.');
        }

        $member = $student->doctoralCommittee->first(fn ($f) => $f->user_id !== null);

        return [$student, $member];
    }

    private function actingAsDoctoral(Faculty $faculty): void
    {
        $user = User::findOrFail($faculty->user_id);
        $user->current_role_id = Role::where('role', 'doctoral')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');
    }

    public function test_a_committee_member_may_propose_a_change_for_their_own_student(): void
    {
        [$student, $member] = $this->studentWithCommittee();
        $this->actingAsDoctoral($member);

        // 'doctoral' also holds can_edit_doctoral_committee, so this applies
        // immediately rather than queuing for DORDC approval; either way a
        // 403 never fires for a member proposing on their own committee.
        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'remove',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'old_faculty_code' => $member->faculty_code,
        ])->assertStatus(201);
    }

    public function test_a_faculty_member_off_the_committee_cannot_propose_a_change(): void
    {
        [$student, $member] = $this->studentWithCommittee();

        $stranger = Faculty::whereNotNull('user_id')
            ->where('faculty_code', '!=', $member->faculty_code)
            ->get()
            ->first(fn ($f) => !$student->checkDoctoralCommittee($f->faculty_code));

        if (!$stranger) {
            $this->markTestSkipped('Every faculty with a login in this database sits on that students committee.');
        }

        $this->actingAsDoctoral($stranger);

        $this->postJson('/api/supervisor-doctoral-changes/propose', [
            'student_id' => $student->roll_no,
            'change_type' => 'remove',
            'member_type' => 'doctoral',
            'faculty_type' => 'internal',
            'old_faculty_code' => $member->faculty_code,
        ])->assertStatus(403);

        $this->assertDatabaseHas('doctoral_commitee', [
            'student_id' => $student->roll_no,
            'faculty_id' => $member->faculty_code,
        ]);
    }
}
