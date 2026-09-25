<?php

namespace Tests\Feature;

use App\Http\Controllers\UrfController;
use App\Models\User;
use App\Pages\UgProfilePage;
use Tests\TestCase;

/**
 * A UG student's home as the server describes it: their details, locked once
 * they hold a project, and their projects naming the other member only.
 */
class UgProfileViewTest extends TestCase
{
    private function viewOf(array $mine): array
    {
        // Their URF standing as the endpoint would answer them.
        $this->app->instance(UrfController::class, new class($mine) extends UrfController {
            public function __construct(private array $mine)
            {
            }

            public function mine()
            {
                return response()->json($this->mine);
            }
        });

        return (new UgProfilePage())->view((new User())->forceFill(['first_name' => 'Ug', 'last_name' => 'Two']));
    }

    private function mine(array $overrides = []): array
    {
        return array_merge([
            'account' => ['email' => 'two@thapar.edu', 'phone' => '9876543210', 'gender' => 'Female'],
            'student' => ['roll_no' => '102203002', 'branch_id' => 1, 'year' => 3, 'semester_of_study' => 5, 'branch' => ['name' => 'Electronics', 'programme' => 'BE']],
            'applications' => [],
        ], $overrides);
    }

    private function application(array $overrides = []): array
    {
        return array_merge([
            'session' => 2026,
            'project_title' => 'Low power sensing',
            'status' => 'applied',
            'student1_name' => 'Ug One',
            'student1_email' => 'one@thapar.edu',
            'student1_roll_no' => '102203001',
            'student1_year' => 2,
            'student1_branch' => ['name' => 'Computer Science'],
            'student2_name' => 'Ug Two',
            'student2_email' => 'TWO@thapar.edu',
            'student2_roll_no' => '102203999',
            'student2_year' => 4,
            'mentor1' => ['faculty_code' => 'F1', 'user' => ['first_name' => 'Asha', 'last_name' => 'Rao']],
        ], $overrides);
    }

    private static function row(array $view, string $label): array
    {
        return collect($view['sections'][0]['rows'])->firstWhere('label', $label);
    }

    public function test_before_applying_every_detail_is_theirs_to_edit(): void
    {
        $view = $this->viewOf($this->mine());

        $this->assertSame('Ug Two', $view['title']);
        $this->assertArrayNotHasKey('disabled', self::row($view, 'Roll Number'));
        $this->assertSame(['102203002', 'Electronics', '3rd Year'], [self::row($view, 'Roll Number')['value'], self::row($view, 'Branch')['value'], self::row($view, 'Year')['value']]);
        $this->assertSame('/urf/me', $view['edit']['request']['path']);
        $this->assertCount(1, $view['sections']);
    }

    public function test_a_project_locks_who_they_are_and_names_the_other_member(): void
    {
        $view = $this->viewOf($this->mine(['applications' => [$this->application(), $this->application(['session' => 2025, 'student1_name' => null])]]));

        $this->assertTrue(self::row($view, 'Branch')['disabled']);
        $this->assertArrayNotHasKey('disabled', self::row($view, 'Phone'));
        $this->assertSame('URF 2026 · Low power sensing', $view['sections'][0]['lines'][0]['text']);
        $this->assertSame([['code' => 'F1', 'name' => 'Asha Rao']], $view['sections'][0]['lines'][2]['links']);

        [$current, $past] = [$view['sections'][1], $view['sections'][2]];
        $this->assertSame(['Ug One', 'Computer Science', '2nd Year'], [$current['rows'][0]['teammate'], $current['rows'][0]['teammate_branch'], $current['rows'][0]['teammate_year']]);
        $this->assertSame(['N/A', 'N/A', 'N/A'], [$past['rows'][0]['teammate'], $past['rows'][0]['teammate_branch'], $past['rows'][0]['teammate_year']]);
    }

    public function test_an_account_the_office_made_reads_its_details_from_the_project(): void
    {
        $view = $this->viewOf($this->mine(['student' => null, 'applications' => [$this->application()]]));

        $this->assertNull($view['edit']);
        $this->assertSame(['102203999', '4th Year'], [self::row($view, 'Roll Number')['value'], self::row($view, 'Year')['value']]);
    }
}
