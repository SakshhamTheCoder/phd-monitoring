<?php

namespace Tests\Unit;

use App\Forms\FormDefinition;
use App\Forms\IrbConstitutionDefinition;
use App\Forms\IrbExtensionDefinition;
use App\Forms\IrbSubmissionDefinition;
use App\Forms\ListOfExaminersDefinition;
use App\Forms\ReviseTitleDefinition;
use App\Forms\SemesterOffDefinition;
use App\Forms\StatusChangeDefinition;
use App\Forms\SupervisorAllocationDefinition;
use App\Forms\SupervisorChangeDefinition;
use App\Forms\ThesisExtensionDefinition;
use Tests\TestCase;

/**
 * The views in tests/fixtures/form-views are what the web and the app draw from
 * in their own tests. This keeps them equal to what the server actually sends,
 * so a change here that a client has not been shown fails on this side.
 *
 * After a deliberate change, regenerate them with
 *   UPDATE_FORM_VIEWS=1 php artisan test --filter=FormViewContractTest
 * and review the diff before committing it.
 */
class FormViewContractTest extends TestCase
{
    private const DEFINITIONS = [
        'revise-title' => ReviseTitleDefinition::class,
        'irb-extension' => IrbExtensionDefinition::class,
        'thesis-extension' => ThesisExtensionDefinition::class,
        'semester-off' => SemesterOffDefinition::class,
        'status-change' => StatusChangeDefinition::class,
        'supervisor-change' => SupervisorChangeDefinition::class,
        'irb-submission' => IrbSubmissionDefinition::class,
        'supervisor-allocation' => SupervisorAllocationDefinition::class,
        'irb-constitution' => IrbConstitutionDefinition::class,
        'list-of-examiners' => ListOfExaminersDefinition::class,
    ];

    public static function forms(): array
    {
        return array_map(fn ($class) => [$class], self::DEFINITIONS);
    }

    /** @dataProvider forms */
    public function test_the_fixture_is_what_the_server_sends(string $class): void
    {
        $type = array_search($class, self::DEFINITIONS, true);
        $path = base_path("tests/fixtures/form-views/$type.json");
        $cases = json_decode(file_get_contents($path), true);
        $this->assertNotEmpty($cases);

        foreach ($cases as &$case) {
            $data = $case['formData'];
            unset($data['view']);
            $view = (new $class)->view($data);
            if (getenv('UPDATE_FORM_VIEWS')) {
                $case['formData']['view'] = $view;
                continue;
            }
            $this->assertSame($case['formData']['view'], $view, "$type: {$case['name']}");
        }

        if (getenv('UPDATE_FORM_VIEWS')) {
            file_put_contents($path, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
            $this->markTestIncomplete("$type.json rewritten; review the diff.");
        }
    }

    /**
     * Only the holder of a step may edit it, and only until they submit it.
     * The older pages left a step's fields open to anyone who opened the form
     * before it was submitted; this keeps that from coming back.
     *
     * @dataProvider forms
     */
    public function test_only_the_holder_of_an_open_step_gets_open_fields(string $class): void
    {
        $type = array_search($class, self::DEFINITIONS, true);
        $cases = json_decode(file_get_contents(base_path("tests/fixtures/form-views/$type.json")), true);
        $this->assertNotEmpty($cases);
        foreach ($cases as $case) {
            $data = $case['formData'];
            foreach ($data['view']['panels'] as $step => $panel) {
                foreach ($this->fieldsOf($panel['rows'] ?? []) as $field) {
                    if (($field['locked'] ?? null) === false && ($field['type'] ?? null) !== 'recommendation') {
                        $this->assertTrue(
                            FormDefinition::mayEdit($data, $step),
                            "$type, {$case['name']}: {$field['label']} is open to {$data['role']} on the $step step"
                        );
                    }
                }
            }
        }
    }

    private function fieldsOf(array $rows): array
    {
        $fields = [];
        foreach ($rows as $row) {
            $kind = $row['kind'] ?? null;
            if ($kind === 'grid') {
                array_push($fields, ...$row['items']);
            } elseif ($kind === 'group') {
                array_push($fields, ...$this->fieldsOf($row['rows']));
            } else {
                $fields[] = $row;
            }
        }
        return $fields;
    }

    /** @dataProvider forms */
    public function test_every_view_carries_the_scholars_own_panel(string $class): void
    {
        // Without it the scholar's step falls back to the plain recommendation,
        // which asks them whether they recommend their own application.
        $view = (new $class)->view(['role' => 'student', 'locks' => []]);
        $this->assertSame(FormDefinition::VERSION, $view['version']);
        // A chain that starts later heads the form with the scholar instead.
        if (isset($view['lead'])) {
            $this->assertNotEmpty($view['lead']['rows']);
            return;
        }
        $this->assertArrayHasKey('student', $view['panels']);
        $panel = $view['panels']['student'];
        $this->assertTrue(!empty($panel['custom']) || !empty($panel['rows']));
    }

    public function test_revise_title_asks_for_what_it_asked_before(): void
    {
        $this->assertSame([
            'revised_title' => 'required|string|max:1000',
            'revised_objectives' => 'required|array|min:1',
            'revised_objectives.*' => 'required|string|max:2000',
        ], (new ReviseTitleDefinition)->rules('student'));

        // Only the scholar enters anything; the rest recommend.
        foreach (['faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc'] as $step) {
            $this->assertSame([], (new ReviseTitleDefinition)->rules($step), $step);
        }
    }

    public function test_irb_extension_asks_for_what_it_asked_before(): void
    {
        $definition = new IrbExtensionDefinition;
        $this->assertSame([
            'reason' => 'required|string',
            'research_pdf' => 'required|file|mimes:pdf|max:20480',
        ], $definition->rules('student', ['research_pdf' => null]));
        // A resubmission keeps the stored proposal unless a new one comes.
        $this->assertSame('nullable|file|mimes:pdf|max:20480', $definition->rules('student', ['research_pdf' => 'a.pdf'])['research_pdf']);
    }

    public function test_thesis_extension_asks_for_what_it_asked_before(): void
    {
        $definition = new ThesisExtensionDefinition;
        $first = ['date_of_synopsis' => null, 'previous_extensions' => []];
        $this->assertSame(['date_of_synopsis' => 'required|date', 'reason' => 'string'], $definition->rules('student', $first));
        // The synopsis date is asked only while none is on record.
        $this->assertSame(['reason' => 'string'], $definition->rules('student', ['date_of_synopsis' => '2025-11-20'] + $first));

        $repeat = ['date_of_synopsis' => '2025-11-20', 'previous_extensions' => [['created_at' => '2025-12-01T00:00:00.000000Z']]];
        $this->assertSame([
            'reason' => 'string',
            'previous_extention_pdf' => 'required|file|mimes:pdf|max:20480',
        ], $definition->rules('student', $repeat + ['previous_extention_pdf' => null]));
        $this->assertSame('nullable|file|mimes:pdf|max:20480', $definition->rules('student', $repeat + ['previous_extention_pdf' => 'b.pdf'])['previous_extention_pdf']);
    }

    public function test_semester_off_asks_for_what_it_asked_before(): void
    {
        $definition = new SemesterOffDefinition;
        $first = ['previous_off' => [], 'previous_approval_pdf' => null];
        $this->assertSame([
            'semester_off_required' => 'required|string',
            'proof_pdf' => 'file|mimes:pdf|max:20480',
            'reason' => 'required|string',
        ], $definition->rules('student', $first));

        // A repeat request also needs the earlier approval, once.
        $repeat = ['previous_off' => [['semester_off_required' => '2425EVEN']]];
        $this->assertSame('required|file|mimes:pdf|max:20480', $definition->rules('student', $repeat + $first)['previous_approval_pdf']);
        $this->assertSame('nullable|file|mimes:pdf|max:20480', $definition->rules('student', $repeat + ['previous_approval_pdf' => 'p.pdf'])['previous_approval_pdf']);
    }

    public function test_semester_off_offers_the_terms_the_page_offered(): void
    {
        $view = (new SemesterOffDefinition)->view(['role' => 'student', 'locks' => []]);
        $select = collect($view['panels']['student']['rows'])->flatMap(fn ($row) => $row['items'] ?? [])->firstWhere('type', 'select');
        $this->assertSame(
            array_map(fn ($code) => ['value' => $code, 'title' => $code], \App\Support\ReportPeriods::around(0, 1)),
            $select['options']
        );
    }

    public function test_status_change_asks_for_what_it_asked_before(): void
    {
        $this->assertSame(['reason' => 'required|string'], (new StatusChangeDefinition)->rules('student', []));
    }

    public function test_supervisor_change_asks_for_what_it_asked_before(): void
    {
        $definition = new SupervisorChangeDefinition;
        $this->assertEquals([
            'prefrences' => 'required|array',
            'to_change' => 'required|array',
            'reason' => 'required|string',
        ], $definition->rules('student', []));
        $this->assertSame(['new_supervisors' => 'required|array'], $definition->rules('phd_coordinator', []));
    }

    public function test_the_coordinator_allots_only_while_their_step_is_open(): void
    {
        $atCoordinator = ['role' => 'phd_coordinator', 'locks' => ['student' => true, 'phd_coordinator' => false]];
        $kinds = fn ($data) => array_column((new SupervisorChangeDefinition)->view($data)['panels']['phd_coordinator']['rows'], 'kind');

        $this->assertSame(['list', 'grid'], $kinds($atCoordinator));
        // Once allotted, or for anyone else, it is the table of who was allotted.
        $this->assertSame(['grid'], $kinds(['locks' => ['phd_coordinator' => true]] + $atCoordinator));
        $this->assertSame(['grid'], $kinds(['role' => 'hod'] + $atCoordinator));
        $this->assertFalse((new SupervisorChangeDefinition)->view($atCoordinator)['panels']['phd_coordinator']['wrapped']);
    }

    public function test_irb_submission_asks_for_what_it_asked_before(): void
    {
        $definition = new IrbSubmissionDefinition;
        $this->assertEquals([
            'revised_phd_objectives' => 'required|array',
            'revised_phd_title' => 'required|string',
            'irb_pdf' => 'required|file|mimes:pdf|max:20480',
            'date_of_irb' => 'required|string',
        ], $definition->rules('student', ['revised_irb_pdf' => null]));
        $this->assertSame('nullable|file|mimes:pdf|max:20480', $definition->rules('student', ['revised_irb_pdf' => 'a.pdf'])['irb_pdf']);
        // The supervisor's count is checked by the controller, and only on a recommendation.
        $this->assertSame([], $definition->rules('faculty', []));
    }

    public function test_only_the_office_may_resend_the_review_while_it_waits_on_the_expert(): void
    {
        $notices = fn (array $data) => (new IrbSubmissionDefinition)->view($data + ['form_id' => 9, 'locks' => []])['notices'];

        foreach (\App\Http\Controllers\ExternalReviewController::RESEND_ROLES as $role) {
            $notice = $notices(['stage' => 'external', 'role' => $role]);
            $this->assertSame('/irb-submissions/9/resend-external-review', $notice[0]['action']['endpoint'], $role);
        }
        $this->assertSame([], $notices(['stage' => 'external', 'role' => 'hod']));
        $this->assertSame([], $notices(['stage' => 'doctoral', 'role' => 'dordc']));
    }

    public function test_supervisor_allocation_names_the_scholars_panel_and_describes_the_coordinators(): void
    {
        $definition = new SupervisorAllocationDefinition;
        $view = $definition->view(['role' => 'phd_coordinator', 'locks' => ['student' => true]]);
        $this->assertSame(['custom' => 'supervisor-preferences'], $view['panels']['student']);
        $this->assertSame(['supervisors' => 'required|array'], $definition->rules('phd_coordinator', []));
        // The scholar's answers are checked by the controller, as before.
        $this->assertSame([], $definition->rules('student', []));
    }

    public function test_irb_constitution_asks_for_what_it_asked_before(): void
    {
        $definition = new IrbConstitutionDefinition;
        $profileEmpty = ['cgpa' => null, 'gender' => null, 'irb_pdf' => null];
        $this->assertEquals([
            'gender' => 'required|string|in:Male,Female',
            'cgpa' => 'required|numeric',
            'objectives' => 'required|array',
            'title' => 'required|string',
            'irb_pdf' => 'required|file|mimes:pdf|max:20480',
            'address' => 'required|string',
            'broad_area_of_research' => 'nullable|string|max:255',
            'subdomains' => 'nullable|array',
            'subdomains.*' => 'string',
        ], $definition->rules('student', $profileEmpty));

        // CGPA and gender are asked only while the profile lacks them.
        $profileFull = $definition->rules('student', ['cgpa' => '8.1', 'gender' => 'Male', 'irb_pdf' => 'a.pdf']);
        $this->assertSame('nullable|numeric', $profileFull['cgpa']);
        $this->assertSame('nullable|string|in:Male,Female', $profileFull['gender']);
        $this->assertSame('nullable|file|mimes:pdf|max:20480', $profileFull['irb_pdf']);

        // The later steps are checked by the controller, and only on Recommend.
        foreach (['faculty', 'hod', 'dordc'] as $step) {
            $this->assertSame([], $definition->rules($step, []), $step);
        }
    }

    public function test_a_carried_over_irb_shows_its_facts_not_the_chain(): void
    {
        $view = (new IrbConstitutionDefinition)->view(['role' => 'admin', 'locks' => [], 'carried_over_at' => '2026-09-01', 'date_of_irb' => null]);
        $this->assertSame("This IRB was constituted before the portal. The record was brought in from the office's sheet on {carried_over_at}, so no step here was answered.", $view['summary']['note']);
        $this->assertArrayNotHasKey('summary', (new IrbConstitutionDefinition)->view(['role' => 'admin', 'locks' => []]));
    }

    public function test_list_of_examiners_heads_with_the_scholar_and_lets_the_director_reject(): void
    {
        $view = (new ListOfExaminersDefinition)->view(['role' => 'director', 'locks' => []]);
        $this->assertSame('Student', $view['lead']['title']);
        $this->assertSame(['director' => ['allow_rejection' => true]], $view['step_options']);
        $this->assertSame(['custom' => 'examiner-nominations'], $view['panels']['faculty']);
        $this->assertSame(['custom' => 'examiner-decisions'], $view['panels']['dordc']);
    }

        public function test_a_locked_or_foreign_reader_gets_no_inputs_and_no_submit(): void
    {
        $base = ['phd_title' => 'Old', 'objectives' => ['One'], 'revised_title' => 'New', 'revised_objectives' => ['Two']];
        $readers = [
            'scholar after submitting' => ['role' => 'student', 'locks' => ['student' => true]],
            'supervisor' => ['role' => 'faculty', 'locks' => ['student' => false]],
            'admin' => ['role' => 'admin', 'locks' => []],
        ];
        foreach ($readers as $who => $reader) {
            $rows = (new ReviseTitleDefinition)->view($base + $reader)['panels']['student']['rows'];
            $fields = collect($rows)->flatMap(fn ($row) => $row['kind'] === 'grid' ? $row['items'] : [$row]);
            $this->assertFalse($fields->contains('type', 'submit'), $who);
            $this->assertFalse($fields->contains(fn ($field) => ($field['locked'] ?? null) === false), $who);
        }
    }
}
