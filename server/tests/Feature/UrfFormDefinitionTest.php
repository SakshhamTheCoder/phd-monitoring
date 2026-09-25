<?php

namespace Tests\Feature;

use App\Forms\UrfFormDefinition;
use Tests\TestCase;

/**
 * A URF form as the clients draw it: what the student filed, locked, and each
 * approver's recommendation posting to the form's decision endpoint.
 */
class UrfFormDefinitionTest extends TestCase
{
    private function data(array $overrides = []): array
    {
        return array_merge([
            'session' => 2026,
            'project_title' => 'Speech models',
            'filled' => null,
            'application' => [
                'project_title' => 'Speech models',
                'session' => 2026,
                'student1_name' => 'Test One', 'student1_roll_no' => '100001', 'student1_year' => 3,
                'student1_branch' => ['name' => 'Computer Engineering'],
                'mentor1' => ['designation' => 'Professor', 'user' => ['first_name' => 'Test', 'last_name' => 'Mentor', 'email' => 'mentor@example.test'], 'department' => ['name' => 'CSED']],
                'proposal' => '/uploads/proposal.pdf',
            ],
        ], $overrides);
    }

    public function test_an_application_reads_its_team_and_posts_decisions_to_its_own_endpoint(): void
    {
        $view = (new UrfFormDefinition('urf-application', 'URF Application Form', 5, true))->view($this->data());

        $this->assertSame('URF Application Form', $view['title']);
        $this->assertSame(['URF 2026 · Speech models'], $view['notes']);
        $rows = $view['panels']['student']['rows'];
        $team = $rows[1]['items'][0];
        $this->assertSame('table', $team['type']);
        $this->assertSame('3rd Year', $team['value'][0]['year']);
        $this->assertSame('Test Mentor', $rows[2]['items'][0]['value'][0]['name']);
        // Nothing the student filed can be changed here.
        foreach ($rows as $row) {
            foreach ($row['items'] ?? [] as $field) {
                $this->assertTrue($field['locked'] ?? true, $field['label']);
            }
        }
        $this->assertSame('/urf/urf-application/5/decision', $view['step_options']['mentor']['submit_path']);
        $this->assertTrue($view['step_options']['dordc']['allow_rejection']);
        $this->assertFalse($view['step_options']['adordc']['allow_rejection']);
    }

    public function test_a_report_links_its_publications_from_the_answer(): void
    {
        $view = (new UrfFormDefinition('urf-final-report', 'Final Report', 9, false))
            ->view($this->data(['filled' => ['submitted_by' => 'Test One', 'report' => '/uploads/report.pdf']]));

        $rows = $view['panels']['student']['rows'];
        $publications = end($rows);
        $this->assertSame('publications', $publications['kind']);
        $this->assertSame(UrfFormDefinition::PUBLICATION_LISTS, $publications['lists']);
        $this->assertFalse($publications['editable']);
        $this->assertFalse($view['step_options']['dordc']['allow_rejection']);
    }
}
