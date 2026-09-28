<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\Supervisor;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * The round trip an office actually works in.
 *
 * A sheet arrives with gaps the portal cannot fill: a supervisor named without
 * an address, a research area the department's list does not carry, an
 * evaluation with a word where its date belongs. Each import dialog offers the
 * records it is still waiting on as a file in its own columns, so the office
 * fills the one empty column and sends the same file back through the dialog
 * it came from, rather than hunting through the sheet for which rows failed.
 */
class ImportsOfferTheRowsStillMissingSomethingTest extends TestCase
{
    use DatabaseTransactions;

    private function actAs(string $role): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', $role)->firstOrFail()->id;
        $user->save();

        return tap($user->fresh(), fn ($fresh) => $this->actingAs($fresh, 'sanctum'));
    }

    public function test_the_scholars_import_offers_those_with_no_supervisor(): void
    {
        $this->actAs('admin');

        $alone = Student::whereNotIn('roll_no', Supervisor::query()->select('student_id'))->first();
        if (!$alone) {
            $this->markTestSkipped('Every scholar has a supervisor.');
        }

        $answer = $this->getJson('/api/students/without-a-supervisor')->assertStatus(200);

        $this->assertSame(
            ['Registration Number', 'Full Name', 'Email', 'Department Code', 'Supervisor 1 Name', 'Supervisor 1 Email'],
            $answer->json('headers'),
            'the file is in the shape the scholars import reads'
        );

        $row = collect($answer->json('rows'))->firstWhere(0, (string) $alone->roll_no);
        $this->assertNotNull($row, 'a scholar with no supervisor is in the file');
        $this->assertSame(['', ''], [$row[4], $row[5]], 'the supervisor columns are the empty ones to fill');
    }

    public function test_a_scholar_who_has_a_supervisor_is_not_in_that_file(): void
    {
        $this->actAs('admin');

        $supervised = Supervisor::first();
        if (!$supervised) {
            $this->markTestSkipped('Nobody is supervised yet.');
        }

        $rolls = collect($this->getJson('/api/students/without-a-supervisor')->json('rows'))->pluck(0);

        $this->assertNotContains((string) $supervised->student_id, $rolls);
    }

    public function test_the_faculty_import_offers_those_with_no_research_area(): void
    {
        $this->actAs('admin');

        $unfiled = Faculty::whereNull('area_of_specialization_id')->where('type', 'internal')->whereHas('user')->first();
        if (!$unfiled) {
            $this->markTestSkipped('Every internal faculty has a research area.');
        }

        $answer = $this->getJson('/api/faculty/without-an-area')->assertStatus(200);

        $this->assertSame(
            ['Emp id', 'Full Name', 'Email', 'Department Code', 'Broad Area of Expertise'],
            $answer->json('headers')
        );

        $row = collect($answer->json('rows'))->firstWhere(0, (string) $unfiled->faculty_code);
        $this->assertNotNull($row);
        $this->assertSame('', $row[4], 'the area column is the empty one to fill');
    }

    public function test_a_supervisor_cannot_take_either_file(): void
    {
        $this->actAs('faculty');

        $this->getJson('/api/students/without-a-supervisor')->assertStatus(403);
        $this->getJson('/api/faculty/without-an-area')->assertStatus(403);
    }
}
