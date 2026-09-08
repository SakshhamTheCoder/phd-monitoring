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
            ->assertJsonPath('data.0.roll_no', $student->roll_no);
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
}
