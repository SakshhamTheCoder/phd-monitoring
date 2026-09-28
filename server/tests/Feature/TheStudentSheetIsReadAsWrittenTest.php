<?php

namespace Tests\Feature;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The office's scholar sheet, read the way the office wrote it.
 *
 * Two things cost a real import most of its rows. Dates arrive as 23-Feb-2026
 * or 10-01-2024 depending on the machine that typed them, and went to the
 * database as text, where the row was refused whole. And a scholar already
 * here under a different address was refused rather than updated, which threw
 * away every other correction that row carried.
 */
class TheStudentSheetIsReadAsWrittenTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'SHET'],
            ['name' => 'Sheet Reading Test Department']
        );

        $this->office = $this->userAs('admin', [
            'can_manage_students' => 'true',
            'can_read_all_students' => 'true',
        ]);
    }

    private function userAs(string $role, array $capabilities = [], ?string $email = null): User
    {
        $roleId = Role::where('role', $role)->value('id')
            ?? DB::table('roles')->insertGetId(['role' => $role, 'created_at' => now(), 'updated_at' => now()]);
        if ($capabilities) {
            DB::table('roles')->where('id', $roleId)->update($capabilities);
        }

        $user = new User();
        $user->forceFill([
            'first_name' => 'Sheet',
            'last_name' => Str::random(6),
            'email' => $email ?? Str::lower(Str::random(10)) . '@sheet.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();

        return $user->fresh();
    }

    private function scholarAlreadyHere(string $email): Student
    {
        return Student::create([
            'roll_no' => 995001,
            'user_id' => $this->userAs('student', [], $email)->id,
            'department_id' => $this->department->id,
            'date_of_registration' => '2019-07-31',
            'current_status' => 'full-time',
            'overall_progress' => 0,
        ]);
    }

    private function import(array $row)
    {
        return $this->actingAs($this->office, 'sanctum')->postJson('/api/students/bulk-upload', [
            'students' => [array_merge([
                'row_number' => 214,
                'full_name' => 'Sheet Scholar',
                'email' => 'sheet.scholar@thapar.test',
                'roll_no' => '995001',
                'department_code' => 'SHET',
            ], $row)],
        ]);
    }

    private function said($response): string
    {
        return json_encode($response->json('data.errors'));
    }

    /** The shapes the sheet actually holds, all of them the same day. */
    public function test_a_date_the_sheet_wrote_its_own_way_still_lands(): void
    {
        $scholar = $this->scholarAlreadyHere('sheet.scholar@thapar.test');

        $this->import([
            'date_of_irb' => '11-Oct-2024',
            'date_of_synopsis' => '23-Feb-2026',
            'date_of_registration' => '10-01-2024',
        ])->assertStatus(200);

        $scholar = $scholar->fresh();
        $this->assertSame('2024-10-11', $scholar->date_of_irb->toDateString());
        $this->assertSame('2026-02-23', $scholar->date_of_synopsis->toDateString());
        $this->assertSame('2024-01-10', $scholar->date_of_registration->toDateString(), 'the day comes first here');
    }

    /**
     * A cell holding a word is said out loud and the rest of the row still
     * lands, rather than the row being refused over one column.
     */
    public function test_a_date_cell_holding_something_else_is_reported_and_the_row_still_lands(): void
    {
        $scholar = $this->scholarAlreadyHere('sheet.scholar@thapar.test');

        $response = $this->import([
            'date_of_irb' => 'awaited',
            'phd_title' => 'A title the row also carried',
        ])->assertStatus(200);

        $this->assertStringContainsString("Row 214: date_of_irb reads 'awaited'", $this->said($response));
        $this->assertSame('A title the row also carried', $scholar->fresh()->phd_title);
        $this->assertSame(1, $response->json('data.update_count'));
    }

    /**
     * The registration number is here under another address. The sheet is the
     * newer record, so it wins, and the change is said out loud because it is
     * how the person signs in.
     */
    public function test_the_sheets_address_replaces_the_stored_one(): void
    {
        $scholar = $this->scholarAlreadyHere('old.address@thapar.test');

        $response = $this->import(['phd_title' => 'Carried in on the same row'])->assertStatus(200);

        $this->assertSame('sheet.scholar@thapar.test', $scholar->fresh()->user->email);
        $this->assertSame('Carried in on the same row', $scholar->fresh()->phd_title);
        $this->assertStringContainsString('sign-in address changed from old.address@thapar.test', $this->said($response));
        $this->assertSame(1, $response->json('data.update_count'));
        $this->assertSame(0, $response->json('data.error_count'));
    }

    /** Two scholars, one row: still refused, because the row names two people. */
    public function test_a_row_naming_two_different_scholars_is_still_refused(): void
    {
        $this->scholarAlreadyHere('sheet.scholar@thapar.test');
        Student::create([
            'roll_no' => 995002,
            'user_id' => $this->userAs('student', [], 'someone.else@thapar.test')->id,
            'department_id' => $this->department->id,
            'date_of_registration' => '2020-07-31',
            'current_status' => 'full-time',
            'overall_progress' => 0,
        ]);

        $response = $this->import(['roll_no' => '995002'])->assertStatus(200);

        $this->assertStringContainsString('belong to different scholars', $this->said($response));
        $this->assertSame('someone.else@thapar.test', Student::find(995002)->user->email);
    }

    /** A member of staff's address in the email column creates no scholar. */
    public function test_a_faculty_address_in_the_sheet_creates_no_scholar(): void
    {
        $staff = $this->userAs('faculty', [], 'staff.member@thapar.test');
        Faculty::create([
            'faculty_code' => 995100,
            'user_id' => $staff->id,
            'designation' => 'Professor',
            'department_id' => $this->department->id,
            'type' => 'internal',
        ]);

        $response = $this->import([
            'email' => 'staff.member@thapar.test',
            'roll_no' => '995003',
            'phone' => '9800000701',
            'date_of_registration' => '2021-07-31',
            'current_status' => 'full-time',
        ])->assertStatus(200);

        $this->assertStringContainsString("is a faculty member's address", $this->said($response));
        $this->assertSame(0, Student::where('roll_no', 995003)->count());
    }

    /** An account with no degree behind it is given one, not refused. */
    public function test_an_account_without_a_scholar_record_is_given_one(): void
    {
        $this->userAs('student', [], 'no.record@thapar.test');

        $response = $this->import([
            'email' => 'no.record@thapar.test',
            'roll_no' => '995004',
            'phone' => '9800000702',
            'date_of_registration' => '02-Apr-2024',
            'current_status' => 'full-time',
        ])->assertStatus(200);

        $this->assertSame(1, $response->json('data.success_count'), $this->said($response));
        $scholar = Student::where('roll_no', 995004)->firstOrFail();
        $this->assertSame('no.record@thapar.test', $scholar->user->email);
        $this->assertSame('2024-04-02', $scholar->date_of_registration->toDateString());
    }
}
