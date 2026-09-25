<?php

namespace Tests\Feature;

use App\Http\Controllers\UrfController;
use App\Models\User;
use App\Pages\UrfRecordPage;
use Tests\TestCase;

/**
 * The URF project page as the server describes it: the project and its team,
 * each form as a card rather than its contents spelled out, and no stipend
 * details anywhere on it.
 */
class UrfRecordViewTest extends TestCase
{
    private function viewOf(array $project): array
    {
        // The project as the endpoint would answer the reader.
        $this->app->instance(UrfController::class, new class($project) extends UrfController {
            public function __construct(private array $project)
            {
            }

            public function show($id)
            {
                return response()->json($this->project);
            }
        });

        return (new UrfRecordPage())->view(new User(), ['id' => 4]);
    }

    private function project(array $overrides = []): array
    {
        return array_merge([
            'id' => 4,
            'session' => 2026,
            'status' => 'selected',
            'stage' => 'complete',
            'history' => [],
            'project_title' => 'Low power sensing',
            'student1_name' => 'Ug One',
            'student1_roll_no' => '102203001',
            'student1_year' => 3,
            // What used to be spelled out on this page, for anyone who could open it.
            'fellows' => [['id' => 7, 'full_name' => 'Ug One', 'pan' => 'ABCDE1234F', 'aadhaar' => '123456789012', 'account_no' => '987654321098']],
            'reports' => [['id' => 9, 'type' => 'half_yearly', 'conference_presentation' => 'Patiala']],
            'can_decide' => true,
        ], $overrides);
    }

    public function test_it_names_the_project_and_its_team(): void
    {
        $view = $this->viewOf($this->project());

        $this->assertSame('Low power sensing', $view['title']);
        $team = $view['sections'][2]['parts'][0]['rows'][0];
        $this->assertSame(['102203001', '3rd Year', 'N/A'], [$team['roll_no'], $team['year'], $team['branch']]);
        $this->assertSame('Approved by the mentor, the ADORDC and the DORDC.', $view['sections'][0]['facts'][3]['text']);
    }

    public function test_it_keeps_the_stipend_details_off_the_page(): void
    {
        $json = json_encode($this->viewOf($this->project()));

        foreach (['ABCDE1234F', '123456789012', '987654321098', 'Patiala'] as $value) {
            $this->assertStringNotContainsString($value, $json);
        }
    }

    public function test_it_offers_each_form_as_a_card(): void
    {
        $forms = $this->viewOf($this->project())['sections'][1]['forms'];

        $this->assertSame(['URF Application Form', 'Additional Information Form', 'Half-yearly Progress Report'], array_column($forms, 'form_name'));
        $this->assertSame('/urf/urf-half-yearly-report/9', $forms[2]['path']);
    }

    public function test_only_an_applied_project_is_offered_a_decision(): void
    {
        $this->assertSame([], $this->viewOf($this->project())['actions']);
        $this->assertSame(['Select', 'Reject'], array_column($this->viewOf($this->project(['status' => 'applied']))['actions'], 'label'));
        $this->assertSame([], $this->viewOf($this->project(['status' => 'applied', 'can_decide' => false]))['actions']);
    }

    public function test_the_approval_line_says_whom_it_waits_on(): void
    {
        $facts = fn (array $overrides) => $this->viewOf($this->project($overrides))['sections'][0]['facts'][3]['text'];

        $this->assertSame('Waiting on the faculty mentor.', $facts(['stage' => 'mentor']));
        $this->assertSame('Rejected by the office. Not funded', $facts(['history' => [['step' => 'office', 'decision' => 'rejected', 'comments' => 'Not funded']]]));
        $this->assertSame('Rejected by the DORDC.', $facts(['history' => [['step' => 'dordc', 'decision' => 'reject']]]));
    }
}
