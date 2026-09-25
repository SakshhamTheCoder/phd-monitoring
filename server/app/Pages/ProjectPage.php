<?php

namespace App\Pages;

use App\Http\Controllers\ProjectController;
use App\Models\FeatureFlag;
use App\Models\User;
use App\Projects\ProjectWizard;
use App\Support\Badge;
use App\Support\ProjectBudget;
use App\Support\ProjectDuration;
use App\Support\Rupees;

/**
 * One project (params.id): its figures, then five tabs of what it is, its
 * money, its milestones, its team and its documents, each value phrased
 * here and each change offered only to the project's writers. The changes
 * themselves go to the project endpoints as before; the page is read again
 * after each. A value is sent as the runs of text the page draws, a date as
 * {date} for the reader's calendar to print, a run of several as one list.
 */
final class ProjectPage extends PageDefinition
{
    private const EMPTY = 'N/A';

    // The badge beside each milestone names the status; the icon only helps
    // the eye run down the timeline.
    private const MILESTONE_ICONS = ['Completed' => 'fa-check', 'In Progress' => 'fa-hourglass-half', 'Not Started' => 'fa-circle-o', 'Delayed' => 'fa-exclamation'];

    public function allows(User $user): bool
    {
        return FeatureFlag::enabled('project_management') && $user->may('can_manage_projects');
    }

    public function view(User $user, array $params = []): array
    {
        $answer = app(ProjectController::class)->show($params['id'] ?? 0);
        // A project that is not there, or not the reader's, is said to be not found.
        if (in_array($answer->getStatusCode(), [403, 404], true)) {
            return self::page('Project not found.', null, ['id' => null]);
        }
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        $project = json_decode(json_encode($answer->getData()), true);
        $canEdit = $project['can_edit'] !== false;
        $milestones = $project['milestones'] ?? [];
        $progress = ProjectWizard::progress($milestones);
        $completed = count(array_filter($milestones, fn ($m) => $m['status'] === 'Completed'));
        $openPositions = count(array_filter($project['positions'] ?? [], fn ($p) => ($p['status'] ?? 'Open') === 'Open'));
        $sdgs = collect(config('sdgs.goals'))->keyBy('id');
        $sanction = self::sanction($project);

        return self::page((string) $project['title'], null, [
            'id' => $project['id'],
            'page_class' => 'reveal',
            'back' => 'Back to projects',
            'badges' => [Badge::of($project['category']), Badge::of($project['status'])],
            'can_edit' => $canEdit,
            'actions' => $canEdit ? array_values(array_filter([
                ['label' => 'Edit project', 'variant' => 'secondary', 'edits' => $project['id']],
                FeatureFlag::enabled('job_openings')
                    ? ['label' => $openPositions ? 'Manage recruitment' : 'Post an opening', 'navigate' => "/projects/{$project['id']}/recruit"]
                    : null,
            ])) : [],
            'tabs' => ['Overview', 'Funding and budget', 'Milestones', 'Project team', 'Documents'],
            'facts' => [
                ['label' => 'Funding agency', 'value' => [($project['funding_agency'] ?? '') ?: self::EMPTY]],
                ['label' => 'Sanctioned amount', 'value' => ['₹ ', Rupees::grouped((int) ($project['amount'] ?? 0))]],
                ['label' => 'Duration', 'value' => array_merge(
                    [ProjectDuration::format($project['duration_years'], $project['duration_months'])],
                    // One run of text, as the page has always drawn it.
                    ($project['start_date'] ?? null) ? [[' · ', ['date' => $project['start_date']], ' to ', ['date' => $project['end_date']]]] : [],
                )],
            ],
            'progress' => [
                'label' => 'Current progress',
                'percent' => $progress,
                'note' => $milestones ? [(string) $completed, ' of ', (string) count($milestones), ' milestones completed'] : null,
            ],
            'overview' => [
                'objectives' => array_map(
                    fn ($o) => is_string($o) ? $o : implode(': ', array_filter([$o['title'] ?? null, $o['description'] ?? null])),
                    $project['objectives'] ?? [],
                ),
                'no_objectives' => 'No objectives recorded.',
                'description' => ($project['description'] ?? '') ?: 'No description added.',
                'metadata' => [
                    ['label' => 'Primary category', 'value' => $project['category']],
                    ['label' => 'Focus area', 'value' => ($project['focus_area'] ?? '') ?: self::EMPTY],
                    ['label' => 'Grant type', 'value' => ($project['grant_type'] ?? '') ?: self::EMPTY],
                    ['label' => 'Project status', 'badge' => Badge::of($project['status'])],
                ],
                'sdgs' => array_values(array_filter(array_map(fn ($id) => isset($sdgs[$id]) ? ['id' => $id, 'text' => [(string) $id, '. ', $sdgs[$id]['label']]] : null, $project['sdgs'] ?? []))),
                'no_sdgs' => 'None selected',
            ],
            'funding' => [
                'facts' => [
                    ['label' => 'Total sanctioned', 'value' => Rupees::short($project['amount'])],
                    ['label' => 'TIET share', 'value' => $project['tiet_share'] === null ? self::EMPTY : Rupees::short($project['tiet_share'])],
                ],
                'sanction' => $sanction,
                'budget' => $answer->getData()->budget ?? (object) [],
            ],
            'gantt' => [
                'name' => ($project['gantt_chart_name'] ?? '') ?: 'Gantt chart',
                'path' => ($project['gantt_chart_path'] ?? '') ?: null,
                'upload' => ($project['gantt_chart_name'] ?? '') ? 'Replace Gantt chart' : 'Upload Gantt chart',
                'none' => 'No Gantt chart uploaded yet.',
            ],
            'milestones' => array_map(fn ($m) => [
                'id' => $m['id'],
                'name' => $m['name'],
                'deliverable' => $m['deliverable'],
                'due' => $m['due_date'],
                'status' => $m['status'],
                'badge' => Badge::of($m['status']),
                'icon' => self::MILESTONE_ICONS[$m['status']] ?? 'fa-circle-o',
                'class' => strtolower(preg_replace('/ /', '-', (string) $m['status'], 1)),
            ], $milestones),
            'pi' => self::pi($project['pi'] ?? null),
            'co_pis' => $project['co_pis'] ?? [],
            'documents' => array_map(fn ($d) => [
                'id' => $d['id'],
                'name' => $d['name'],
                'type' => $d['type'],
                'date' => $d['doc_date'],
                'url' => ($d['file_path'] ?? null) ?: ($d['link'] ?? null),
                'file_path' => $d['file_path'] ?? null,
                'link' => $d['link'] ?? null,
            ], $project['documents'] ?? []),
            'options' => [
                'milestoneStatuses' => ProjectWizard::MILESTONE_STATUSES,
                'manpowerCategories' => ProjectBudget::MANPOWER_CATEGORIES,
                'budgetHeads' => ProjectBudget::heads(),
                'sdgs' => config('sdgs.goals'),
                'duration' => ['years' => ProjectDuration::yearOptions(), 'maxMonths' => ProjectDuration::MAX_MONTHS],
            ],
            // What a milestone needs before it is sent, in the order it is checked.
            'milestone_checks' => [
                ['key' => 'name', 'message' => 'Milestone name is required.'],
                ['key' => 'deliverable', 'message' => 'Deliverable is required.'],
                ['key' => 'dueDate', 'message' => 'Due date is required.'],
            ],
        ]);
    }

    /** The sanction letter: a stored file or an external link, or nothing. */
    private static function sanction(array $project): ?array
    {
        $link = $project['sanction_letter_link'] ?? null;
        if (!$link || $link === '#') {
            return null;
        }
        return [
            'name' => ($project['sanction_letter_name'] ?? '') ?: 'Sanction Letter',
            'url' => $link,
            'is_link' => (bool) preg_match('#^https?://#i', $link),
        ];
    }

    private static function pi(?array $pi): ?array
    {
        return $pi ? [
            'code' => $pi['faculty_code'],
            'name' => $pi['user'] ? trim(($pi['user']['first_name'] ?? '') . ' ' . ($pi['user']['last_name'] ?? '')) : '',
            'department' => $pi['department']['name'] ?? '',
            'designation' => ($pi['designation'] ?? '') ?: '',
        ] : null;
    }
}
