<?php

namespace App\Pages;

use App\Http\Controllers\ProjectController;
use App\Models\FeatureFlag;
use App\Models\User;
use App\Support\Badge;
use App\Support\ProjectDuration;
use App\Support\Rupees;
use Illuminate\Http\Request;

/**
 * The projects overview: the reader's projects and the figures across them.
 * The page itself (its words, columns and the delete question) is described
 * once and kept; the figures and rows come from GET /projects/overview, each
 * value already phrased, so a search asks for rows only.
 */
final class ProjectsPage extends PageDefinition
{
    private const EMPTY = 'N/A';

    private const EXPORT_HEADERS = ['Project Title', 'Category', 'Your role', 'Funding Agency', 'Amount', 'Duration', 'Status'];

    public function allows(User $user): bool
    {
        return FeatureFlag::enabled('project_management') && $user->may('can_manage_projects');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Projects overview', 'Monitoring all ongoing research initiatives and funding channels.', [
            'actions' => [
                ['label' => 'Export CSV', 'variant' => 'secondary', 'exports' => 'projects_export.csv'],
                ['label' => 'Create project', 'navigate' => '/projects/create'],
            ],
            'data' => '/projects/overview',
            // Shown until the figures arrive.
            'facts' => self::facts(['active' => 0, 'completed' => 0, 'totalFunding' => 0, 'consultancy' => 0, 'international' => 0]),
            'columns' => ['Project title', 'Category', 'Your role', 'Funding agency', 'Amount', 'Duration', 'Status'],
            'row' => ['opens' => '/projects/{id}', 'edit' => 'Edit project', 'delete' => 'Delete project', 'read_only' => 'View only', 'open' => 'Open project'],
            'states' => [
                'loading' => 'Loading projects',
                'failed' => 'Could not load your projects. Check your connection and try again.',
                'empty' => 'No projects yet.',
                'no_match' => 'No projects match these filters.',
            ],
            'dialogs' => [
                'delete' => [
                    'title' => 'Delete project',
                    'text' => ['Are you sure you want to delete ', ['strong' => '{title}'], '? This action cannot be undone.'],
                    'button' => 'Delete',
                    'request' => ['method' => 'DELETE', 'path' => '/projects/{id}', 'done' => null, 'failure' => 'fetch', 'loader' => false],
                ],
            ],
        ]);
    }

    private static function facts(array $stats): array
    {
        $pad = fn ($count) => str_pad((string) $count, 2, '0', STR_PAD_LEFT);
        return [
            ['label' => 'Active projects', 'value' => $pad($stats['active'])],
            ['label' => 'Completed', 'value' => $pad($stats['completed'])],
            ['label' => 'Total sanctioned', 'value' => Rupees::short($stats['totalFunding'])],
            ['label' => 'Consultancy', 'value' => $pad($stats['consultancy'])],
            ['label' => 'International', 'value' => $pad($stats['international']), 'note' => 'Collaborative'],
        ];
    }

    /**
     * The figures and the rows for the overview, searched by `filters` as
     * the projects list is. Answers GET /projects/overview.
     */
    public static function overview(Request $request): array
    {
        $controller = app(ProjectController::class);
        $list = $controller->index($request);
        abort_if($list->getStatusCode() !== 200, $list->getStatusCode());
        $stats = $controller->stats()->getData(true);
        $projects = json_decode(json_encode($list->getData()), true);

        return [
            'facts' => self::facts($stats),
            'rows' => array_map(fn ($p) => [
                'id' => $p['id'],
                'title' => $p['title'],
                'category' => Badge::of($p['category']),
                'role' => $p['viewer_role'] ?: self::EMPTY,
                'agency' => $p['funding_agency'],
                'amount' => Rupees::short($p['amount']),
                'duration' => ProjectDuration::format($p['duration_years'], $p['duration_months']),
                'status' => Badge::of($p['status']),
                'can_edit' => $p['can_edit'] !== false,
            ], $projects),
            // What Export CSV writes: the figures as stored, not as drawn.
            'export' => [
                'headers' => self::EXPORT_HEADERS,
                'rows' => array_map(fn ($p) => [$p['title'], $p['category'], $p['viewer_role'], $p['funding_agency'], $p['amount'], ProjectDuration::format($p['duration_years'], $p['duration_months']), $p['status']], $projects),
            ],
        ];
    }
}
