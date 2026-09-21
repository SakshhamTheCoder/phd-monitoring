<?php

namespace Tests\Feature;

use App\Models\ConstituteOfIRB;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IrbSubForm;
use App\Models\Role;
use App\Models\Student;
use App\Models\SupervisorAllocation;
use App\Models\SynopsisSubmission;
use App\Models\ThesisSubmission;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Importing scholars who are part way through the degree.
 *
 * The office's sheet records the journey as filled columns: supervisors named,
 * a date of IRB, a date of synopsis, a date of thesis. The portal opens each
 * form off the previous one finishing, so writing the dates alone left every
 * imported scholar with one open allocation form and no way to reach the form
 * they actually needed next.
 *
 * So each bucket of the sheet is checked here for the forms it should end with.
 */
class CarriedOverMilestonesImportTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $office;
    private Faculty $supervisor;
    private int $nextFacultyCode = 993001;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'CMIL'],
            ['name' => 'Carried Over Milestones Test Department']
        );

        $this->office = $this->userAs('admin', [
            'can_manage_students' => 'true',
            'can_read_all_students' => 'true',
        ]);

        $this->supervisor = $this->facultyFor($this->userAs('faculty'));
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
            'first_name' => 'Milestone',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@milestones.test',
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
            'full_name' => 'Milestone Scholar',
            'email' => 'milestone.scholar@thapar.test',
            'roll_no' => '993501',
            'phone' => '9800000601',
            'department_code' => 'CMIL',
            'date_of_registration' => '2019-07-31',
            'current_status' => 'full-time',
            'phd_title' => 'A thesis begun long before the portal',
            'supervisors' => [$this->supervisor->user->email],
        ], $overrides);
    }

    private function import(array $rows)
    {
        return $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/students/bulk-upload', ['students' => $rows]);
    }

    private function scholar(): Student
    {
        return Student::where('roll_no', 993501)->firstOrFail();
    }

    private function formTypes(): array
    {
        return Forms::where('student_id', 993501)->pluck('form_type')->all();
    }

    private function assertOpen(string ...$formTypes): void
    {
        $open = $this->formTypes();

        foreach ($formTypes as $formType) {
            $this->assertContains($formType, $open, "{$formType} should be available to this scholar");
        }
    }

    /**
     * Supervisors on the row mean the allocation already happened.
     *
     * Without this the scholar is shown an open allocation form asking for
     * supervisors they have had for years, and because that form never
     * completes, the five forms its approval opens never appear. The IRB
     * constitution is one of them, which is the next thing a pre-IRB scholar
     * has to file.
     */
    public function test_named_supervisors_carry_the_allocation_over(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        $allocation = SupervisorAllocation::where('student_id', 993501)->firstOrFail();
        $this->assertNotNull($allocation->carried_over_at);
        $this->assertSame('complete', $allocation->completion);
        $this->assertSame('complete', $allocation->stage);
        $this->assertSame([$this->supervisor->faculty_code], $allocation->supervisors);

        $this->assertOpen(
            'supervisor-allocation',
            'supervisor-change',
            'irb-constitution',
            'status-change',
            'list-of-examiners',
            'semester-off'
        );

        $this->assertSame(
            'complete',
            Forms::where('student_id', 993501)->where('form_type', 'supervisor-allocation')->value('stage')
        );
    }

    /** A row with no supervisor is not a statement that anyone was allocated. */
    public function test_a_row_without_supervisors_leaves_the_allocation_to_be_filed(): void
    {
        $row = $this->row();
        unset($row['supervisors']);

        $this->import([$row])->assertStatus(200);

        $this->assertSame(0, SupervisorAllocation::where('student_id', 993501)->count());
        $this->assertOpen('supervisor-allocation');
        $this->assertNotContains('irb-constitution', $this->formTypes());
    }

    /**
     * A date of IRB is the submission having happened, not just the committee
     * being formed: it is the date the portal's own IRB submission writes onto
     * the scholar. So both forms are carried over, and the synopsis and thesis
     * forms the submission opens arrive with them.
     */
    public function test_a_date_of_irb_carries_over_both_the_constitution_and_the_submission(): void
    {
        $this->import([$this->row(['date_of_irb' => '2021-03-04'])])->assertStatus(200);

        $this->assertNotNull(ConstituteOfIRB::where('student_id', 993501)->value('carried_over_at'));
        $this->assertTrue($this->scholar()->irbCompleted());

        $submission = IrbSubForm::where('student_id', 993501)->firstOrFail();
        $this->assertNotNull($submission->carried_over_at);
        $this->assertSame('complete', $submission->completion);
        $this->assertSame('2021-03-04', $submission->date_of_irb);

        $this->assertOpen(
            'irb-constitution',
            'irb-submission',
            'irb-extension',
            'synopsis-submission',
            'thesis-submission',
            'thesis-extension'
        );
    }

    /**
     * Synopsis and thesis are opened by the revised IRB finishing, and the
     * sheet never says whether one was filed. A scholar who has submitted
     * their synopsis needs those forms either way.
     */
    public function test_a_date_of_synopsis_carries_the_synopsis_over_and_opens_what_follows(): void
    {
        $this->import([$this->row([
            'date_of_irb' => '2021-03-04',
            'date_of_synopsis' => '2025-02-03',
        ])])->assertStatus(200);

        $synopsis = SynopsisSubmission::where('student_id', 993501)->firstOrFail();
        $this->assertNotNull($synopsis->carried_over_at);
        $this->assertSame('complete', $synopsis->stage);
        $this->assertSame('approved', $synopsis->status);

        $this->assertOpen('synopsis-submission', 'thesis-submission', 'thesis-extension');
        $this->assertSame(0, ThesisSubmission::where('student_id', 993501)->count());
    }

    public function test_a_date_of_thesis_carries_the_thesis_submission_over(): void
    {
        $this->import([$this->row([
            'date_of_irb' => '2021-03-04',
            'date_of_synopsis' => '2025-02-03',
            'date_of_thesis' => '2026-02-03',
        ])])->assertStatus(200);

        $thesis = ThesisSubmission::where('student_id', 993501)->firstOrFail();
        $this->assertNotNull($thesis->carried_over_at);
        $this->assertSame('complete', $thesis->completion);
        $this->assertSame('2025-02-03', $thesis->date_of_synopsis);
    }

    /**
     * A carried over form still has to open when somebody clicks it.
     *
     * It is a real row of a real form, built with every field the scholar
     * would have filled left empty, so the page that draws it is the thing
     * most likely to object.
     */
    public function test_each_carried_over_form_still_loads(): void
    {
        $this->import([$this->row([
            'date_of_irb' => '2021-03-04',
            'date_of_synopsis' => '2025-02-03',
            'date_of_thesis' => '2026-02-03',
        ])])->assertStatus(200);

        $forms = [
            'supervisor-allocation' => SupervisorAllocation::where('student_id', 993501)->value('id'),
            'irb-constitution' => ConstituteOfIRB::where('student_id', 993501)->value('id'),
            'irb-submission' => IrbSubForm::where('student_id', 993501)->value('id'),
            'synopsis-submission' => SynopsisSubmission::where('student_id', 993501)->value('id'),
            'thesis-submission' => ThesisSubmission::where('student_id', 993501)->value('id'),
        ];

        foreach ($forms as $formType => $id) {
            $this->actingAs($this->office, 'sanctum')
                ->getJson("/api/students/993501/forms/{$formType}/{$id}")
                ->assertStatus(200);
        }
    }

    /** No step of a carried over form claims an approval nobody gave here. */
    public function test_a_carried_over_form_claims_no_approvals(): void
    {
        $this->import([$this->row(['date_of_synopsis' => '2025-02-03'])])->assertStatus(200);

        foreach ([SupervisorAllocation::class, SynopsisSubmission::class] as $model) {
            $form = $model::where('student_id', 993501)->firstOrFail();

            foreach (['supervisor', 'phd_coordinator', 'hod', 'dordc', 'doctoral'] as $role) {
                $this->assertNotTrue((bool) $form->{$role . '_approval'}, $role . ' approved nothing here');
            }

            $this->assertStringContainsString('before the portal', json_encode($form->history));
        }
    }

    /** The office re-sends the same sheet after correcting one row in it. */
    public function test_importing_the_same_sheet_twice_records_each_milestone_once(): void
    {
        $row = $this->row([
            'date_of_irb' => '2021-03-04',
            'date_of_synopsis' => '2025-02-03',
            'date_of_thesis' => '2026-02-03',
        ]);

        $this->import([$row])->assertStatus(200);
        $this->import([$row])->assertStatus(200);

        $this->assertSame(1, SupervisorAllocation::where('student_id', 993501)->count());
        $this->assertSame(1, ConstituteOfIRB::where('student_id', 993501)->count());
        $this->assertSame(1, IrbSubForm::where('student_id', 993501)->count());
        $this->assertSame(1, SynopsisSubmission::where('student_id', 993501)->count());
        $this->assertSame(1, ThesisSubmission::where('student_id', 993501)->count());
        $this->assertSame(count($this->formTypes()), count(array_unique($this->formTypes())));
    }

    /**
     * A scholar imported before this existed, corrected by a later import.
     *
     * The dates were already on the record, so the second import has to notice
     * the milestones it did not record the first time.
     */
    public function test_a_scholar_already_in_the_portal_gets_the_milestones_they_were_missing(): void
    {
        $this->import([$this->row()])->assertStatus(200);

        $this->import([$this->row([
            'date_of_irb' => '2021-03-04',
            'date_of_synopsis' => '2025-02-03',
        ])])->assertStatus(200);

        $this->assertNotNull(ConstituteOfIRB::where('student_id', 993501)->value('carried_over_at'));
        $this->assertNotNull(SynopsisSubmission::where('student_id', 993501)->value('carried_over_at'));
        $this->assertOpen('synopsis-submission', 'thesis-submission');
    }
}
