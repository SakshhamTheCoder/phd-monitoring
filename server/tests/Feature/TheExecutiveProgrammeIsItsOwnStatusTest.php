<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use App\Support\CourseworkRequirement;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Executive is one of three statuses the portal stores, and code that asked
 * "part time?" and called everything else full time got it wrong twice: the
 * thesis form named the wrong status, and the status change form, which only
 * swaps full time and part time, wrote an executive scholar down as full time
 * once approved.
 */
class TheExecutiveProgrammeIsItsOwnStatusTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(['code' => 'EXEC'], ['name' => 'Executive Test Department']);
    }

    private function scholar(string $status): User
    {
        $roleId = Role::where('role', 'student')->value('id');
        $user = new User();
        $user->forceFill([
            'first_name' => 'Executive',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@executive.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        Student::create([
            'roll_no' => random_int(996000, 996999),
            'user_id' => $user->id,
            'department_id' => $this->department->id,
            'date_of_registration' => '2023-08-09',
            'current_status' => $status,
            'overall_progress' => 0,
        ]);

        return $user->fresh();
    }

    /** The form swaps two statuses, so the third may not enter it. */
    public function test_an_executive_scholar_cannot_raise_a_status_change(): void
    {
        $executive = $this->scholar('executive');

        $this->actingAs($executive, 'sanctum')
            ->postJson('/api/forms/status-change')
            ->assertStatus(403)
            ->assertJsonPath('message', fn ($message) => str_contains($message, 'executive programme'));

        $this->assertSame('executive', $executive->student->fresh()->current_status);
    }

    /** A full time scholar still raises one, so the guard is not a wall. */
    public function test_a_full_time_scholar_still_raises_a_status_change(): void
    {
        $scholar = $this->scholar('full-time');
        \App\Support\FormLadder::openOne($scholar->student, 'status-change');

        $this->actingAs($scholar, 'sanctum')
            ->postJson('/api/forms/status-change')
            ->assertStatus(200);
    }

    /** The executive programme's credits are the UGC figure, not the cohort's. */
    public function test_an_executive_scholar_is_measured_against_the_ugc_figure(): void
    {
        $executive = $this->scholar('executive');
        $fullTime = $this->scholar('full-time');

        $this->assertSame(12, CourseworkRequirement::for($executive->student));
        $this->assertSame(14, CourseworkRequirement::for($fullTime->student), 'admitted August 2023, so the middle band');
    }
}
