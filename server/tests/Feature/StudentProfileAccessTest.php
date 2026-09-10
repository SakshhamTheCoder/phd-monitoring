<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * StudentController::get had no branch for a doctoral committee member, so it
 * fell through to the 403, while list() had one. A committee member therefore
 * saw a student in the listing and was refused when they opened them, and so
 * was a supervisor following the committee list on a faculty profile.
 */
class StudentProfileAccessTest extends TestCase
{
    use DatabaseTransactions;

    /** A student with a doctoral committee, and a member of it. */
    private function studentWithCommittee(): array
    {
        $student = Student::query()->get()->first(fn ($s) => $s->doctoralCommittee->count() > 0);

        if (!$student) {
            $this->markTestSkipped('No student in this database has a doctoral committee.');
        }

        return [$student, $student->doctoralCommittee->first()];
    }

    private function actAs(Faculty $faculty, string $role): void
    {
        $user = User::findOrFail($faculty->user_id);
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');
    }

    public function test_a_committee_member_can_open_the_student(): void
    {
        [$student, $member] = $this->studentWithCommittee();
        $this->actAs($member, 'doctoral');

        $this->getJson("/api/students/{$student->roll_no}")
            ->assertStatus(200)
            ->assertJsonPath('profile.roll_no', $student->roll_no);
    }

    /**
     * The faculty profile lists the committees a member sits on and links each
     * student, so acting as faculty has to open them too.
     */
    public function test_a_faculty_on_the_committee_can_open_the_student(): void
    {
        [$student, $member] = $this->studentWithCommittee();
        $this->actAs($member, 'faculty');

        $this->getJson("/api/students/{$student->roll_no}")->assertStatus(200);
    }

    public function test_an_unrelated_faculty_is_still_refused(): void
    {
        [$student, $member] = $this->studentWithCommittee();

        $stranger = Faculty::whereNotNull('user_id')
            ->where('faculty_code', '!=', $member->faculty_code)
            ->get()
            ->first(fn ($f) => !$student->checkSupervises($f->faculty_code)
                && !$student->checkDoctoralCommittee($f->faculty_code));

        if (!$stranger) {
            $this->markTestSkipped('Every faculty in this database is related to that student.');
        }

        $this->actAs($stranger, 'faculty');

        $this->getJson("/api/students/{$student->roll_no}")->assertStatus(403);
    }

    /**
     * The page decides what to offer from these three keys, so they have to be
     * present and have to mean the same thing they mean on a faculty profile.
     */
    public function test_the_profile_carries_what_the_viewer_may_do(): void
    {
        [$student, $member] = $this->studentWithCommittee();
        $this->actAs($member, 'doctoral');

        $this->getJson("/api/students/{$student->roll_no}")
            ->assertStatus(200)
            // A committee member reads the record; they do not write it.
            ->assertJson(['is_self' => false, 'can_edit' => false, 'can_manage' => false]);
    }

    /** A role that provisions students may write any of them. */
    public function test_a_privileged_role_may_manage_the_profile(): void
    {
        [$student, $member] = $this->studentWithCommittee();
        $this->actAs($member, 'dordc');

        $this->getJson("/api/students/{$student->roll_no}")
            ->assertStatus(200)
            ->assertJson(['can_edit' => true, 'can_manage' => true]);
    }

    /** The soft write is addressed by roll number, like the faculty one. */
    public function test_a_committee_member_cannot_write_the_profile(): void
    {
        [$student, $member] = $this->studentWithCommittee();
        $this->actAs($member, 'doctoral');

        $this->postJson("/api/students/{$student->roll_no}/profile", ['fathers_name' => 'Nope'])
            ->assertStatus(403);
    }

    /** "me" and the roll number are two addresses for one profile. */
    public function test_a_student_reads_their_own_profile_from_me(): void
    {
        $student = Student::query()->whereNotNull('user_id')->first();

        if (!$student || !$student->user) {
            $this->markTestSkipped('No student with a user account in this database.');
        }

        $user = $student->user;
        $user->current_role_id = Role::where('role', 'student')->firstOrFail()->id;
        $user->save();
        $this->actingAs($user->fresh(), 'sanctum');

        $this->getJson('/api/students/me')
            ->assertStatus(200)
            ->assertJsonPath('profile.roll_no', $student->roll_no)
            ->assertJson(['is_self' => true, 'can_edit' => true, 'can_manage' => false]);
    }
}
