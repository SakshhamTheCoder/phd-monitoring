<?php

namespace Tests\Feature;

use App\Models\Faculty;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * The outside supervisors, and their own import.
 *
 * A supervisor and a doctoral committee member are both read from the faculty
 * table, so an academic at another institute needs a record here or the seat
 * the scholars sheet names for them stays empty. They are kept off the
 * institute's staff sheet, which is a list of its own employees: this file has
 * no employee code column, because theirs is minted, and asks where they work
 * instead. Adding them one at a time through Add faculty mails each of them a
 * sign-in link as it goes, which is not how 39 records should arrive.
 */
class ExternalFacultyImportTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        $user = User::whereNotNull('role_id')->firstOrFail();
        $user->current_role_id = Role::where('role', 'admin')->firstOrFail()->id;
        $user->save();

        $this->actingAs($user->fresh(), 'sanctum');

        return $user;
    }

    /** One row of the external supervisors sheet, in its own column names. */
    private function row(array $overrides = []): array
    {
        return array_merge([
            '_rowNumber' => 2,
            'Full Name' => 'Dr. Sanjeev Bedi',
            'Email' => 'sbedi.external@demo.invalid',
            'Phone' => '',
            'Designation' => 'Professor',
            'Department Code' => 'CSED',
            'Institution' => 'University of Waterloo',
            'Website Link' => 'https://uwaterloo.ca',
            'Areas of Expertise (comma separated)' => 'Machining, CAD',
        ], $overrides);
    }

    private function import(array $row)
    {
        return $this->postJson('/api/faculty/bulk-import-external', ['rows' => [$row]]);
    }

    public function test_an_outside_supervisor_lands_with_the_code_they_are_given(): void
    {
        $this->admin();
        Mail::fake();

        $response = $this->import($this->row());

        $response->assertOk();
        $this->assertSame([], $response->json('data.errors'));
        $this->assertSame(1, $response->json('data.success_count'));

        $user = User::where('email', 'sbedi.external@demo.invalid')->firstOrFail();
        $faculty = Faculty::where('user_id', $user->id)->firstOrFail();

        $this->assertSame('external', $faculty->type);
        $this->assertSame('University of Waterloo', $faculty->institution);
        $this->assertSame('CSED', $faculty->department->code);
        $this->assertSame('777' . str_pad((string) $user->id, 6, '0', STR_PAD_LEFT), (string) $faculty->faculty_code);

        // The import is a migration, not an onboarding. Nobody hears from the
        // portal until Send sign-in links says so.
        Mail::assertNothingSent();
    }

    public function test_a_row_with_no_institution_still_lands(): void
    {
        $this->admin();

        $response = $this->import($this->row(['Institution' => '']));

        $response->assertOk();
        $this->assertSame([], $response->json('data.errors'));
        $this->assertSame(1, $response->json('data.success_count'));

        $user = User::where('email', 'sbedi.external@demo.invalid')->firstOrFail();
        $faculty = Faculty::where('user_id', $user->id)->firstOrFail();

        $this->assertSame('external', $faculty->type);
        $this->assertNull($faculty->institution);

        // The list still tells them apart from the institute's own staff.
        $listed = $this->getJson('/api/faculty?rows=2000')->json('data');
        $row = collect($listed)->firstWhere('email', 'sbedi.external@demo.invalid');
        $this->assertSame('Outside the institute', $row['outside_institution']);
    }

    public function test_a_row_with_no_department_is_refused(): void
    {
        $this->admin();

        $response = $this->import($this->row(['Department Code' => '']));

        $response->assertOk();
        $this->assertSame(1, $response->json('data.error_count'));
        $this->assertStringContainsString('Department code required', $response->json('data.errors.0'));
    }

    /**
     * The staff sheet is the institute's list of its own employees, and a file
     * sent through it cannot quietly make somebody external whatever a column
     * of it says.
     */
    public function test_the_staff_sheet_still_creates_internal_faculty_only(): void
    {
        $this->admin();

        $response = $this->postJson('/api/faculty/bulk-import', ['rows' => [[
            '_rowNumber' => 2,
            'Emp id' => '9900123',
            'Full Name' => 'Dr. Asha Rao',
            'Email' => 'asha.rao.internal@demo.invalid',
            'Designation' => 'Professor',
            'Department Code' => 'CSED',
            'Type' => 'external',
            'Institution' => 'University of Waterloo',
        ]]]);

        $response->assertOk();
        $this->assertSame([], $response->json('data.errors'));

        $user = User::where('email', 'asha.rao.internal@demo.invalid')->firstOrFail();
        $faculty = Faculty::where('user_id', $user->id)->firstOrFail();

        $this->assertSame('internal', $faculty->type);
        $this->assertSame('9900123', (string) $faculty->faculty_code);
    }
}
