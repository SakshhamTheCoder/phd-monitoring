<?php

namespace App\Pages;

use App\Models\User;
use App\Support\Navigation;

/** Progress monitoring: the current semester's figures and the semesters before it. */
final class PresentationsPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'presentations');
    }

    public function view(User $user, array $params = []): array
    {
        // The office sets a semester's deadline and loads the history from before the portal.
        $office = in_array($user->current_role?->role, ['admin', 'dordc'], true);

        return self::page('Progress monitoring', 'Evaluation semesters and their deadlines.', [
            // Read again with the table, since both show the semester edited.
            'above' => [['block' => 'semester-stats', 'props' => (object) [], 'with_rows' => true]],
            'table' => [
                'endpoint' => '{path}',
                'title' => 'Past semesters',
                'select' => false,
                'opens' => ['navigate' => '{path}/semester/{semester_name}'],
                'toolbar' => $office ? [self::action('Import progress history', 'import', 'secondary')] : [],
                'actions' => $office ? [['label' => 'Edit semester', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'semester']] : [],
            ],
            'dialogs' => $office ? [
                'semester' => [
                    'block' => 'semester-editor',
                    'title' => 'Edit semester deadline',
                    'min_width' => '300px',
                    'min_height' => '300px',
                    // The semester as stored, read quietly: its own failure is said here.
                    'load' => ['path' => '/semester/{semester_name}', 'pick' => 'data', 'quiet' => true, 'failed' => 'Could not load that semester. Try again.'],
                ],
            ] : (object) [],
            'imports' => [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import progress history',
                    'required' => ['Registration Number', 'Progress for AY', 'Total Progress %'],
                    'rules' => [
                        'One row per scholar per semester. The gain for each period is worked out from the totals.',
                        'Progress for AY is the semester code, for example 2425ODD.',
                        'A blank total means the evaluation has not happened yet, so the row is skipped.',
                        'A semester the scholar already has a presentation for is left to its own workflow.',
                    ],
                    'sample' => ['name' => 'progress_history_sample.csv', 'csv' => implode("\n", [
                        'Registration Number,Progress for AY,Date of progress,Total Progress %',
                        '900011,2324ODD,2023-11-04,20',
                        '900011,2324EVEN,2024-04-18,35',
                        '900011,2425ODD,2024-11-06,55',
                    ])],
                    'path' => '/presentation/import-progress',
                    'failed' => 'Import failed',
                ],
            ],
        ]);
    }
}
