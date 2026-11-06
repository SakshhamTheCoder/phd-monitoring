<?php

namespace App\Pages;

use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectImportController;
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

    private const EXPORT_HEADERS = ['Project Title', 'Category', 'PI', 'Funding Agency', 'Amount', 'Duration', 'Status'];

    public function allows(User $user): bool
    {
        return FeatureFlag::enabled('project_management') && $user->may('can_manage_projects');
    }

    public function view(User $user, array $params = []): array
    {
        // Loading other people's projects is the office's; everyone else has the wizard.
        $mayImport = ProjectImportController::mayImport($user);

        return self::page('Projects overview', 'Monitoring all ongoing research initiatives and funding channels.', [
            'actions' => [
                ['label' => 'Export CSV', 'variant' => 'secondary', 'exports' => 'projects_export.csv'],
                ...($mayImport ? [self::action('Import projects', 'import', 'secondary')] : []),
                ['label' => 'Create project', 'navigate' => '/projects/create'],
            ],
            'imports' => $mayImport ? ['import' => self::import()] : (object) [],
            'data' => '/projects/overview',
            // Shown until the figures arrive.
            'facts' => self::facts(['active' => 0, 'completed' => 0, 'totalFunding' => 0, 'consultancy' => 0, 'international' => 0]),
            'columns' => ['Project title', 'Category', 'PI', 'Funding agency', 'Amount', 'Duration', 'Status'],
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

    /** The PI's name as their account has it. */
    private static function piName(array $project, string $none = self::EMPTY): string
    {
        $user = $project['pi']['user'] ?? [];
        $name = trim(($user['first_name'] ?? '') . ' ' . ($user['last_name'] ?? ''));

        return $name !== '' ? $name : $none;
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
                'pi' => self::piName($p),
                'agency' => $p['funding_agency'],
                'amount' => Rupees::short($p['amount']),
                'duration' => ProjectDuration::format($p['duration_years'], $p['duration_months']),
                'status' => Badge::of($p['status']),
                'can_edit' => $p['can_edit'] !== false,
            ], $projects),
            // What Export CSV writes: the figures as stored, not as drawn.
            'export' => [
                'headers' => self::EXPORT_HEADERS,
                'rows' => array_map(fn ($p) => [$p['title'], $p['category'], self::piName($p, ''), $p['funding_agency'], $p['amount'], ProjectDuration::format($p['duration_years'], $p['duration_months']), $p['status']], $projects),
            ],
        ];
    }

    /** The CSV import's dialog: what it needs, what it does, and the file to start from. */
    private static function import(): array
    {
        // The short names the importer reads. The template the office fills
        // carries hints in brackets as well; the importer ignores those.
        $headers = [
            'Project Title', 'PI Name', 'PI Email', 'Category', 'Status', 'Funding Agency', 'Sanctioned Amount',
            'TIET Share', 'Start Date', 'Duration Years', 'Duration Months', 'Focus Area', 'Grant Type',
            'Co-PI 1 Name', 'Co-PI 1 Email', 'Co-PI 2 Name', 'Co-PI 2 Email', 'Co-PI 3 Name', 'Co-PI 3 Email',
            'Description', 'Objective 1', 'Objective 2', 'Objective 3', 'Objective 4', 'Objective 5',
            'SDGs', 'Sanction Letter Link',
        ];
        $line = fn (array $cells) => implode(',', array_map(
            fn ($cell) => preg_match('/[",\n]/', $cell) ? '"' . str_replace('"', '""', $cell) . '"' : $cell,
            $cells
        ));

        return [
            'kind' => 'rows',
            'title' => 'Import projects from CSV',
            'required' => ['Project Title', 'PI Email', 'Category', 'Funding Agency', 'Sanctioned Amount', 'Start Date', 'Duration Years'],
            'rules' => [
                'One row per project. The PI is found by email and must already be faculty in the portal.',
                'A project with the same PI, title and start date is updated from the cells the row fills in.',
                'Dates are DD-MM-YYYY. Amounts are rupees, digits only. Status is Pending when left blank.',
                'Co-PIs are found by email; one who is not internal faculty is added as an external Co-PI.',
                'Budget, milestones and documents are added in the portal afterwards.',
                'A row with a problem is named and left out; the rest of the file still imports.',
            ],
            'sample' => ['name' => 'projects_import_sample.csv', 'csv' => implode("\n", [
                $line($headers),
                $line(['Smart Grid Analytics', 'Dr. A. Sharma', 'a.sharma@thapar.edu', 'Research', 'Active', 'DST', '4850000', '1000000', '01-04-2025', '3', '0', 'Energy', 'CRG', '', '', '', '', '', '', 'Short abstract', 'Build X', 'Evaluate Y', '', '', '', '7,9', 'https://example.org/letter.pdf']),
                $line(['Low power sensing', '', 'b.kaur@thapar.edu', 'Consultancy', '', 'ISRO', '1200000', '', '15-07-2025', '1', '6', '', '', 'Prof. R. Miller', 'r.miller@mit.edu', '', '', '', '', '', '', '', '', '', '', '', '']),
            ])],
            'path' => '/projects/import',
            'failed' => 'Import failed',
            // A long sheet goes a batch at a time, each project in a transaction of its own.
            'batch' => [
                'size' => 25,
                // False, not omitted: the app-wide overlay would cover the dialog's own progress bar.
                'loader' => false,
                'summary' => '{created} added, {updated} updated, {errors} not imported',
                'done' => 'Import completed: {summary}',
                'none' => 'Nothing was imported: {summary}',
                'failed' => 'Batch {n} failed: {message}',
                'crashed' => 'Failed to import CSV',
            ],
        ];
    }
}
