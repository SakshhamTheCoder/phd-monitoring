<?php

namespace Tests\Feature;

use App\Models\ConstituteOfIRB;
use App\Models\Department;
use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IRBCommittee;
use App\Models\OutsideExpert;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Importing a scholar whose IRB was constituted before the portal.
 *
 * The committee rows are the easy half. The half worth pinning is that a
 * constitution form has to exist for them, because irbCompleted() and
 * phdTitleLocked() read the form and not the committee: without one the scholar
 * counts as pre-IRB, their title stays editable, and the supervisor change form
 * refuses to open.
 *
 * And that the form, being a record rather than a decision, is locked by the
 * ordinary rules and claims no approvals.
 */
class CarriedOverIrbImportTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $office;
    private array $members = [];
    private int $nextFacultyCode = 994001;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'CIRB'],
            ['name' => 'Carried Over IRB Test Department']
        );

        $this->office = $this->userAs('admin', [
            'can_manage_students' => 'true',
            'can_read_all_students' => 'true',
        ]);

        foreach ([1, 2] as $i) {
            $this->members[] = $this->facultyFor($this->userAs('faculty'));
        }
    }

    private function userAs(string $role, array $capabilities = []): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => 'Carried',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@carried.test',
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

    private function row(array $overrides = []): array
    {
        return array_merge([
            'full_name' => 'Carried Scholar',
            'email' => 'carried.scholar@thapar.test',
            'roll_no' => '994501',
            'phone' => '9800000501',
            'department_code' => 'CIRB',
            'date_of_registration' => '2021-08-01',
            'date_of_irb' => '2022-03-01',
            'current_status' => 'full-time',
            'gender' => 'Female',
            'phd_title' => 'A title settled years ago',
            'irb_members' => array_map(fn (Faculty $f) => $f->user->email, $this->members),
            'external_expert' => [
                'name' => 'Outside Reviewer',
                'email' => 'outside.reviewer@elsewhere.test',
                'designation' => 'Professor',
                'department' => 'Physics',
                'institution' => 'Elsewhere Institute',
            ],
        ], $overrides);
    }

    private function import(array $rows)
    {
        return $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/students/bulk-upload', ['students' => $rows]);
    }

    private function scholar(): Student
    {
        return Student::where('roll_no', 994501)->firstOrFail();
    }

    /**
     * The IRB committee and the doctoral committee are different bodies, and
     * the sheet lists them in different columns.
     *
     * This is the assertion that matters most in this file. `doctoral_commitee`
     * is not a record, it is a grant: checkDoctoralCommittee() reads it to
     * decide who may answer the `doctoral` step of every form chain, an IRB
     * submission waits for one approval per member of it, and a presentation
     * makes one review row per member. An IRB member added to it by mistake
     * stalls the scholar's own forms waiting on somebody who was never asked.
     */
    public function test_an_irb_member_is_not_given_a_seat_on_the_doctoral_committee(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        $onDoctoral = array_map('intval', DoctoralCommittee::where('student_id', 994501)->pluck('faculty_id')->all());

        foreach ($this->members as $member) {
            $this->assertNotContains(
                $member->faculty_code,
                $onDoctoral,
                'an IRB member must not gain the doctoral step of every form chain'
            );
            $this->assertFalse($this->scholar()->checkDoctoralCommittee($member->faculty_code));
        }
    }

    public function test_the_doctoral_committee_columns_still_fill_the_doctoral_committee(): void
    {
        $separate = $this->facultyFor($this->userAs('faculty'));

        $this->import([$this->row(['committee' => [$separate->user->email]])])->assertStatus(200);

        // The sheet's own doctoral columns, imported by syncSupervisionTeam and
        // untouched by any of this.
        $this->assertTrue($this->scholar()->checkDoctoralCommittee($separate->faculty_code));
    }

    public function test_both_committee_tables_are_written(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        // Written through ScholarCommittee precisely so these two cannot drift.
        $this->assertSame(
            count($this->members),
            IRBCommittee::where('student_id', 994501)->where('type', 'inside')->count()
        );
        $this->assertSame(1, IRBCommittee::where('student_id', 994501)->where('type', 'outside')->count());
        $this->assertNotNull($this->scholar()->outsideExpert());
    }

    public function test_the_scholar_counts_as_having_a_constituted_irb(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        $scholar = $this->scholar();

        $this->assertTrue($scholar->irbCompleted(), 'the title should no longer read as tentative');
        $this->assertTrue($scholar->phdTitleLocked(), 'the title should no longer be editable on the profile');
    }

    public function test_the_form_is_a_record_and_not_a_decision(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        $form = ConstituteOfIRB::where('student_id', 994501)->firstOrFail();

        $this->assertNotNull($form->carried_over_at);
        $this->assertSame('complete', $form->completion);
        $this->assertSame('complete', $form->stage, 'a complete stage is what locks every panel');

        // No step claims an approval, because nobody gave one here.
        foreach (['supervisor', 'phd_coordinator', 'hod', 'dra', 'dordc'] as $role) {
            $this->assertNotTrue((bool) $form->{$role . '_approval'}, $role . ' approved nothing here');
        }

        $this->assertStringContainsString('constituted before the portal', json_encode($form->history));
    }

    public function test_the_forms_it_unlocks_are_opened(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        foreach (['irb-constitution', 'irb-submission', 'irb-extension'] as $type) {
            $this->assertTrue(
                Forms::where('student_id', 994501)->where('form_type', $type)->exists(),
                "{$type} should be available to a scholar whose IRB is constituted"
            );
        }
    }

    public function test_the_external_expert_is_matched_rather_than_duplicated(): void
    {
        $existing = OutsideExpert::create([
            'first_name' => 'Outside',
            'last_name' => 'Reviewer',
            'designation' => 'Professor',
            'institution' => 'Elsewhere Institute',
            'department' => 'Physics',
            'email' => 'outside.reviewer@elsewhere.test',
        ]);

        $this->import([$this->row()])->assertStatus(200);

        $this->assertSame(1, OutsideExpert::where('email', 'outside.reviewer@elsewhere.test')->count());
        $this->assertSame($existing->id, $this->scholar()->outsideExpert()->id);
    }

    /**
     * The shape the office's sheet actually has: a date of IRB, and the member
     * and external expert columns blank on every row.
     *
     * Keying the carried over form off the members would mean no imported
     * scholar ever counted as having an IRB, which is the whole point of
     * recording one.
     */
    public function test_a_date_of_irb_alone_is_enough_to_carry_one_over(): void
    {
        $row = $this->row();
        unset($row['irb_members'], $row['external_expert']);

        $this->import([$row])->assertStatus(200);

        $form = ConstituteOfIRB::where('student_id', 994501)->first();
        $this->assertNotNull($form, 'a date of IRB says the IRB was constituted');
        $this->assertNotNull($form->carried_over_at);
        $this->assertTrue($this->scholar()->irbCompleted());
        $this->assertTrue($this->scholar()->phdTitleLocked());

        // Nobody was named, so nobody was put on a committee.
        $this->assertSame(0, IRBCommittee::where('student_id', 994501)->count());
    }

    public function test_a_scholar_with_no_date_of_irb_gets_no_form(): void
    {
        $row = $this->row();
        unset($row['irb_members'], $row['external_expert'], $row['date_of_irb']);

        $this->import([$row])->assertStatus(200);

        $this->assertSame(0, ConstituteOfIRB::where('student_id', 994501)->count());
        $this->assertFalse($this->scholar()->irbCompleted());
    }

    public function test_a_member_the_portal_does_not_know_is_reported_not_silently_dropped(): void
    {
        $response = $this->import([$this->row([
            'irb_members' => ['nobody@elsewhere.test'],
            'external_expert' => [],
        ])])->assertStatus(200);

        $this->assertStringContainsString('nobody@elsewhere.test', json_encode($response->json('data.errors')));
    }
}
