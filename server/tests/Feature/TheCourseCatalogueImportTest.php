<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The catalogue sheet, which arrives once and has to land in one go.
 *
 * Every case here is a cell the institute's files actually carry: credits
 * written as a word, a subject the sheet names twice, a department code from
 * before the codes were corrected, and a name longer than the column.
 */
class TheCourseCatalogueImportTest extends TestCase
{
    use DatabaseTransactions;

    private Department $department;
    private User $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->department = Department::firstOrCreate(
            ['code' => 'CATT'],
            ['name' => 'Catalogue Test Department']
        );

        $roleId = Role::where('role', 'admin')->value('id');
        $user = new User();
        $user->forceFill([
            'first_name' => 'Catalogue',
            'last_name' => Str::random(6),
            'email' => Str::lower(Str::random(10)) . '@catalogue.test',
            'password' => 'secret-password',
            'role_id' => $roleId,
            'current_role_id' => $roleId,
        ])->save();
        $this->office = $user->fresh();
    }

    /** @param array<int, array<string, string>> $sheet */
    private function import(array $sheet)
    {
        $rows = [];
        foreach ($sheet as $index => $cells) {
            $rows[] = array_merge(['_rowNumber' => $index + 2], $cells);
        }

        return $this->actingAs($this->office, 'sanctum')
            ->postJson('/api/courses/import', ['rows' => $rows]);
    }

    private function said($response): string
    {
        return json_encode($response->json('data.errors'));
    }

    /**
     * A word in the credits column used to be read as zero, which rewrote a
     * subject worth four credits as worth none.
     */
    public function test_credits_written_as_a_word_leave_the_stored_number_alone(): void
    {
        Course::create([
            'course_code' => 'CAT900',
            'course_name' => 'Existing Subject',
            'credits' => 4,
            'department_id' => $this->department->id,
        ]);

        $response = $this->import([
            ['Course Code' => 'CAT900', 'Course Name' => 'Existing Subject', 'Credits' => 'Audit', 'Department Code' => 'CATT'],
        ])->assertStatus(200);

        $this->assertSame(4.0, (float) Course::where('course_code', 'CAT900')->value('credits'));
        $this->assertStringContainsString("credits read 'Audit'", $this->said($response));
        $this->assertSame(0, $response->json('data.error_count'), 'the subject was still updated');
    }

    /**
     * One row the database refuses must not end the request.
     *
     * The catalogue is posted as one file. Before this, a subject name past the
     * column's 255 characters raised a 500 and the office was told nothing
     * about the hundreds of rows that had already landed.
     */
    public function test_a_row_the_database_refuses_does_not_stop_the_rest(): void
    {
        $response = $this->import([
            ['Course Code' => 'CAT100', 'Course Name' => 'Research Methodology', 'Credits' => '4', 'Department Code' => 'CATT'],
            ['Course Code' => 'CAT106', 'Course Name' => str_repeat('A very long subject name ', 20), 'Credits' => '3', 'Department Code' => 'CATT'],
            ['Course Code' => 'CAT101', 'Course Name' => 'Advanced Topics', 'Credits' => '3.5', 'Department Code' => 'CATT'],
        ])->assertStatus(200);

        $this->assertSame(2, $response->json('data.success_count'));
        $this->assertSame(1, $response->json('data.error_count'));
        $this->assertStringContainsString("'CAT106' was not saved", $this->said($response));
        $this->assertTrue(Course::where('course_code', 'CAT101')->exists(), 'the row after it still landed');
    }

    /**
     * What the summary counts as an error is a record that was lost, not a note
     * about one that landed. A subject added with no credits is a note.
     */
    public function test_the_error_count_is_records_lost_not_notes(): void
    {
        $response = $this->import([
            ['Course Code' => 'CAT102', 'Course Name' => 'Seminar', 'Credits' => '', 'Department Code' => 'CATT'],
            ['Course Code' => 'CAT104', 'Course Name' => 'Unknown Department', 'Credits' => '3', 'Department Code' => 'NOSUCH'],
            ['Course Code' => 'CAT105', 'Course Name' => '', 'Credits' => '3', 'Department Code' => 'CATT'],
        ])->assertStatus(200);

        $this->assertSame(1, $response->json('data.success_count'), $this->said($response));
        $this->assertSame(2, $response->json('data.error_count'));
        $this->assertStringContainsString('was added worth 0 credits', $this->said($response));
        $this->assertSame(0.0, (float) Course::where('course_code', 'CAT102')->value('credits'));
    }

    /** A department code from before the codes were corrected still resolves. */
    public function test_a_superseded_department_code_still_files_the_subject(): void
    {
        $this->import([
            ['Course Code' => 'CAT107', 'Course Name' => 'Old Codes Still Read', 'Credits' => '2', 'Department Code' => 'DBT'],
        ])->assertStatus(200);

        $this->assertSame(
            \App\Support\DepartmentCodes::resolve('DBT')->id,
            (int) Course::where('course_code', 'CAT107')->value('department_id')
        );
    }

    /** The same subject twice in one file is one subject, taking the last row. */
    public function test_a_subject_named_twice_in_one_file_is_one_subject(): void
    {
        $this->import([
            ['Course Code' => 'CAT100', 'Course Name' => 'Research Methodology', 'Credits' => '4', 'Department Code' => 'CATT'],
            ['Course Code' => 'CAT100', 'Course Name' => 'Research Methodology II', 'Credits' => '4', 'Department Code' => 'CATT'],
        ])->assertStatus(200);

        $this->assertSame(1, Course::where('course_code', 'CAT100')->count());
        $this->assertSame('Research Methodology II', Course::where('course_code', 'CAT100')->value('course_name'));
    }
}
