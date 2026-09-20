<?php

namespace Tests\Feature;

use App\Models\ConstituteOfIRB;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\OutsideExpert;
use App\Models\Role;
use App\Models\Student;
use App\Models\SupervisorAllocation;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * One scholar walked from nothing through the chains, over the same endpoints
 * the screens call.
 *
 * Nothing here writes a form, a stage or an approval directly. Every step is a
 * POST to the route the client posts to, as the person whose turn it is, so the
 * validation, the turn taking, the locks and the stage transitions are all the
 * real ones. The only direct writes are the fixture: a department and its
 * officers, which the portal has no screen to create from nothing.
 *
 * What it proves, in order:
 *   1. an admin creates the scholar, and their first form opens by itself
 *   2. supervisor allocation, on the long chain, because three supervisors
 *      takes it past the HOD to the DORDC and the Vice Chancellor
 *   3. completing it opens the forms that follow
 *   4. IRB constitution end to end, including the two steps added in this
 *      release, and the committee it writes
 *   5. the ADORDC can read a form and cannot answer it
 *   6. a role out of a chain is not offered the form at all
 */
class ScholarJourneyThroughThePortalTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $admin;
    private array $people = [];
    private int $nextFacultyCode = 996001;
    private int $rollNo = 996501;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->department = Department::firstOrCreate(
            ['code' => 'JRNY'],
            ['name' => 'Journey Test Department']
        );

        $this->admin = $this->userAs('admin', [
            'can_manage_students' => 'true',
            'can_read_all_students' => 'true',
        ]);

        // The department's officers. A form cannot be handed on without them:
        // every transition notifies the next role and reads them off here.
        foreach (['hod', 'phd_coordinator', 'dra', 'dordc', 'adordc', 'director'] as $office) {
            $this->people[$office] = $this->officer($office);
        }

        $this->department->forceFill([
            'hod_id' => $this->people['hod']['faculty']->faculty_code,
            'adordc_id' => $this->people['adordc']['faculty']->faculty_code,
        ])->save();

        DB::table('phd_coordinators')->insert([
            'department_id' => $this->department->id,
            'faculty_id' => $this->people['phd_coordinator']['faculty']->faculty_code,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Six faculty for the scholar to rank, three of whom get allotted, plus
        // two who can sit as cognate experts without supervising.
        for ($i = 0; $i < 6; $i++) {
            $this->people["choice{$i}"] = $this->officer('faculty');
        }
        $this->people['cognateA'] = $this->officer('faculty');
        $this->people['cognateB'] = $this->officer('faculty');
    }

    // ------------------------------------------------------------- fixture

    private function userAs(string $role, array $capabilities = []): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => ucfirst($role),
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(12)) . '@journey.test',
            'password' => 'secret-password',
            'gender' => 'Female',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function officer(string $role): array
    {
        $user = $this->userAs($role);
        $faculty = Faculty::create([
            'faculty_code' => $this->nextFacultyCode++,
            'user_id' => $user->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);

        return ['user' => $user, 'faculty' => $faculty];
    }

    /** As the person whose turn it is, to the route the screen posts to. */
    private function as(User $user)
    {
        return $this->actingAs($user, 'sanctum');
    }

    private function scholar(): Student
    {
        return Student::where('roll_no', $this->rollNo)->firstOrFail();
    }

    private function stageOf(string $formType)
    {
        return Forms::where('student_id', $this->rollNo)->where('form_type', $formType)->value('stage');
    }

    // --------------------------------------------------------- the journey

    public function test_a_scholar_walks_the_chains_over_the_portal_endpoints(): void
    {
        // --- 1. the office creates the scholar ---------------------------
        $this->as($this->admin)->postJson('/api/students/add', [
            'full_name' => 'Journey Scholar',
            'email' => 'journey.scholar@journey.test',
            'phone' => '9800996501',
            // The screen posts a form field, so the roll number arrives as a string.
            'roll_no' => (string) $this->rollNo,
            'department_id' => $this->department->id,
            'date_of_registration' => '2023-08-01',
            'current_status' => 'full-time',
            'gender' => 'Female',
            'cgpa' => 8.2,
        ])->assertStatus(200);

        $scholar = $this->scholar();
        $scholarUser = $scholar->user;
        $this->assertNotNull($scholarUser, 'the account is made with the record');

        // Creating a scholar opens their first form by itself.
        $this->assertTrue(
            Forms::where('student_id', $this->rollNo)->where('form_type', 'supervisor-allocation')->exists(),
            'supervisor allocation should be waiting for a new scholar'
        );

        // --- 2. supervisor allocation ------------------------------------
        $this->as($scholarUser)->postJson('/api/forms/supervisor-allocation')->assertStatus(200);

        $allocation = SupervisorAllocation::where('student_id', $this->rollNo)->firstOrFail();
        $this->assertSame('student', $allocation->stage);

        $choices = [];
        for ($i = 0; $i < 6; $i++) {
            $choices[] = $this->people["choice{$i}"]['faculty']->faculty_code;
        }

        $this->as($scholarUser)->postJson('/api/forms/supervisor-allocation/' . $allocation->id, [
            'prefrences' => $choices,
            'broad_area_of_research' => ['Control systems'],
        ])->assertStatus(200);
        $this->assertSame('phd_coordinator', $allocation->fresh()->stage);

        // Three supervisors, which is what takes this past the HOD.
        $allotted = array_slice($choices, 0, 3);
        $this->as($this->people['phd_coordinator']['user'])
            ->postJson('/api/forms/supervisor-allocation/' . $allocation->id, [
                'approval' => true,
                'supervisors' => $allotted,
            ])->assertStatus(200);

        $allocation = $allocation->fresh();
        $this->assertSame('hod', $allocation->stage);
        $this->assertContains('director', $allocation->steps, 'more than two supervisors adds the Vice Chancellor');

        $this->as($this->people['hod']['user'])
            ->postJson('/api/forms/supervisor-allocation/' . $allocation->id, ['approval' => true, 'comments' => 'Fine'])
            ->assertStatus(200);
        $this->assertSame('dordc', $allocation->fresh()->stage, 'the HOD no longer finishes a three supervisor allocation');

        $this->as($this->people['dordc']['user'])
            ->postJson('/api/forms/supervisor-allocation/' . $allocation->id, ['approval' => true, 'comments' => 'Fine'])
            ->assertStatus(200);
        $this->assertSame('director', $allocation->fresh()->stage);

        $this->as($this->people['director']['user'])
            ->postJson('/api/forms/supervisor-allocation/' . $allocation->id, ['approval' => true, 'comments' => 'Approved'])
            ->assertStatus(200);

        $allocation = $allocation->fresh();
        $this->assertSame('complete', $allocation->completion);
        $this->assertCount(3, $this->scholar()->supervisors, 'the allocation is written when the last step approves');

        // --- 3. completing it opens what follows -------------------------
        foreach (['irb-constitution', 'supervisor-change', 'status-change', 'semester-off'] as $next) {
            $this->assertTrue(
                Forms::where('student_id', $this->rollNo)->where('form_type', $next)->exists(),
                "{$next} should open once supervisors are allotted"
            );
        }

        // --- 4. IRB constitution, end to end ------------------------------
        $this->as($scholarUser)->postJson('/api/forms/irb-constitution')->assertStatus(200);
        $irb = ConstituteOfIRB::where('student_id', $this->rollNo)->firstOrFail();

        $this->as($scholarUser)->post('/api/forms/irb-constitution/' . $irb->id, [
            'objectives' => ['Model the plant', 'Design the controller'],
            'title' => 'A journey through the portal',
            'address' => 'Patiala',
            'semester' => 3,
            // Always required in practice: studentSubmit() asks for the CGPA
            // when the scholar has no gender, and reads gender off the student
            // record where it actually lives on the user, so it is never set.
            'cgpa' => 8.2,
            'gender' => 'Female',
            'irb_pdf' => UploadedFile::fake()->create('irb.pdf', 20, 'application/pdf'),
        ])->assertStatus(200);
        $this->assertSame('supervisor', $irb->fresh()->stage);

        // Every supervisor nominates, and the form waits for all three: the
        // supervisor step is shared, so it moves only once the last one answers.
        $nominees = [
            $this->people['cognateA']['faculty']->faculty_code,
            $this->people['cognateB']['faculty']->faculty_code,
            $this->people['choice5']['faculty']->faculty_code,
        ];

        foreach ([0, 1, 2] as $slot) {
            $last = $slot === 2;
            $this->as($this->people["choice{$slot}"]['user'])
                ->postJson('/api/forms/irb-constitution/' . $irb->id, [
                    'approval' => true,
                    'nominee_cognates' => $nominees,
                ])
                ->assertStatus($last ? 200 : 201);

            $this->assertSame(
                $last ? 'phd_coordinator' : 'supervisor',
                $irb->fresh()->stage,
                'the form waits until every supervisor has approved'
            );
        }

        // The step added in this release: the coordinator now sits between the
        // supervisor and the HOD.
        $this->as($this->people['phd_coordinator']['user'])
            ->postJson('/api/forms/irb-constitution/' . $irb->id, ['approval' => true, 'comments' => 'Fine'])
            ->assertStatus(200);
        $this->assertSame('hod', $irb->fresh()->stage);

        $experts = [];
        foreach (['Alpha', 'Beta', 'Gamma'] as $tag) {
            $experts[] = OutsideExpert::create([
                'first_name' => 'Outside',
                'last_name' => $tag,
                'designation' => 'Professor',
                'institution' => 'Elsewhere Institute',
                'department' => 'Elsewhere',
                'email' => Str::lower($tag . Str::random(5)) . '@outside.test',
            ])->id;
        }

        $this->as($this->people['hod']['user'])->postJson('/api/forms/irb-constitution/' . $irb->id, [
            'approval' => true,
            'chairman_experts' => [$this->people['cognateA']['faculty']->faculty_code],
            'outside_experts' => $experts,
        ])->assertStatus(200);

        // The DRA step, which had a method but no case in submit() before this
        // release, so it could never actually be answered.
        $this->assertSame('dra', $irb->fresh()->stage);
        $this->as($this->people['dra']['user'])
            ->postJson('/api/forms/irb-constitution/' . $irb->id, ['approval' => true, 'comments' => 'Fine'])
            ->assertStatus(200);
        $this->assertSame('dordc', $irb->fresh()->stage);

        // --- 5. the ADORDC reads, and cannot answer ----------------------
        $this->as($this->people['adordc']['user'])
            ->getJson('/api/forms/irb-constitution/' . $irb->id)
            ->assertStatus(200);

        $this->as($this->people['adordc']['user'])
            ->postJson('/api/forms/irb-constitution/' . $irb->id, ['approval' => true, 'comments' => 'no'])
            ->assertStatus(403);
        $this->assertSame('dordc', $irb->fresh()->stage, 'a read only role must not move the form');

        // --- the DORDC constitutes the committee -------------------------
        $this->as($this->people['dordc']['user'])->postJson('/api/forms/irb-constitution/' . $irb->id, [
            'approval' => true,
            'outside_expert' => $experts[1],
            'cognate_expert' => $this->people['cognateB']['faculty']->faculty_code,
        ])->assertStatus(200);

        $irb = $irb->fresh();
        $this->assertSame('complete', $irb->completion);

        $scholar = $this->scholar();
        $this->assertTrue($scholar->irbCompleted(), 'the IRB is constituted');
        $this->assertTrue(
            $scholar->checkDoctoralCommittee($this->people['cognateA']['faculty']->faculty_code),
            "the HOD's cognate expert joins the committee"
        );
        $this->assertTrue(
            $scholar->checkDoctoralCommittee($this->people['cognateB']['faculty']->faculty_code),
            "the DORDC's chosen nominee joins the committee"
        );
        $this->assertNotNull($scholar->outsideExpert(), 'the outside expert is on the IRB committee');

        foreach (['irb-submission', 'irb-extension'] as $next) {
            $this->assertTrue(
                Forms::where('student_id', $this->rollNo)->where('form_type', $next)->exists(),
                "{$next} should open once the IRB is constituted"
            );
        }

        // --- 6. a role out of a chain is not offered the form ------------
        $listed = $this->as($this->people['dra']['user'])
            ->getJson('/api/forms/synopsis-submission')
            ->assertStatus(200)
            ->json('data');

        $this->assertIsArray($listed);
        $this->assertSame(
            [],
            array_filter($listed, fn ($row) => (string) ($row['roll_no'] ?? '') === (string) $this->rollNo),
            'the DRA is no longer a step on the synopsis, so it should not be listed to them'
        );
    }
}
