<?php

namespace App\Pages;

use App\Http\Controllers\UrfDecisionController;
use App\Models\AppSetting;
use App\Models\UrfApplication;
use App\Models\User;
use App\Support\Navigation;

/**
 * URF: the office's page for the Undergraduate Research Fellowship, and a
 * mentor's for the projects they mentor. Everything on it is scoped to what
 * the reader may read, so a mentor gets the same page holding only their own.
 */
final class UrfPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'urf');
    }

    public function view(User $user, array $params = []): array
    {
        $manages = $user->may('can_manage_urf');
        // A mentor reads URF while they mentor something, as /me says.
        $reads = !empty(Navigation::capabilities($user)['can_read_urf_mentees']);
        $open = (bool) AppSetting::value('urf', 'applications_open');
        $sessions = $reads ? UrfApplication::query()
            ->unless($manages, fn ($q) => $q->mentoredBy($user->faculty?->faculty_code))
            ->distinct()->orderByDesc('session')->pluck('session')->values()->all() : [];
        // What is waiting on whoever is reading. The office holds no step on a
        // chain, so it has no queue.
        $queue = $manages ? [] : app(UrfDecisionController::class)->queue()->getData(true)['data'];
        $waiting = array_flip(array_column($queue, 'form'));

        return self::page('URF', $manages
            ? 'Undergraduate Research Fellowship. Applications are ' . ($open ? 'open' : 'closed') . '.'
            : 'The Undergraduate Research Fellowship projects you mentor.', [
            // The queue and the sessions change with the projects.
            'reload_with_table' => true,
            'actions' => $manages ? [
                self::action('Import awarded', 'import', 'secondary'),
                ['label' => $open ? 'Close applications' : 'Open applications', 'request' => [
                    'method' => 'POST',
                    'path' => '/settings/urf',
                    'body' => ['applications_open' => $open ? 0 : 1],
                    'done' => $open ? 'URF applications closed' : 'URF applications opened',
                    'failure' => 'fetch',
                    'loader' => false,
                    'reload_view' => true,
                ]],
            ] : [],
            // Picked beside the stage tabs, above the projects table.
            'scope' => UrfFormListPage::sessionScope($sessions) + ['place' => 'content'],
            'above' => array_values(array_filter([
                // The URF forms as cards, lit where something of that kind waits on the reader.
                $reads ? ['block' => 'form-grid', 'props' => ['forms' => array_map(fn ($type, $name) => [
                    'form_type' => $type,
                    'form_name' => $name,
                    'action_required' => isset($waiting[$type]),
                ], array_keys(UrfFormListPage::FORMS), UrfFormListPage::FORMS)]] : null,
                // The import dialog sits here in the page, as the page drew it.
                $manages ? ['imports' => true] : null,
                $manages ? ['block' => 'urf-report-schedule', 'uses_scope' => true] : null,
                $queue ? ['block' => 'urf-queue', 'props' => ['rows' => $queue]] : null,
            ])),
            // The stage tabs and the session scope the table under them, so the
            // three sit together under one heading.
            'content' => ['block' => 'urf-projects', 'props' => [
                'heading' => $manages ? 'All projects' : 'Projects you mentor',
                // Only an applied project is still to be decided, and deciding is the office's.
                'decides' => $manages,
            ]],
            'imports' => $manages ? [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import awarded projects',
                    'required' => ['project_title', 'student1_name', 'student1_roll_no', 'student1_email', 'mentor1_email'],
                    'rules' => [
                        'For projects awarded before the portal. They are created already selected.',
                        'Nothing is recorded as approved: the decision was taken elsewhere, and the history says so.',
                        "Matched on the first student's email and the session, so the same file twice updates rather than duplicates.",
                        'The mentor is matched by email against institute faculty. A mentor the portal does not know names the row and the row is skipped.',
                        'branch_code is needed only for a student who has no account yet.',
                        'Student accounts are created where they do not exist, and are emailed a link to set a password.',
                        'The proposal PDF is not carried: it was filed outside the portal, so those projects show no proposal link.',
                    ],
                    'sample' => ['name' => 'urf_awarded_sample.csv', 'csv' => implode("\n", [
                        'project_title,session,student1_name,student1_roll_no,student1_email,student1_phone,student1_gender,student1_year,student1_branch_code,student2_name,student2_roll_no,student2_email,student2_phone,student2_gender,student2_year,student2_branch_code,mentor1_email,mentor2_email',
                        'Low power sensing for field robots,2026,Student One,102203001,student.one@thapar.edu,9800000001,Female,3,COE,Student Two,102203002,student.two@thapar.edu,9800000002,Male,3,COE,mentor.one@thapar.edu,',
                    ])],
                    'path' => '/urf/import-awarded',
                    'failed' => 'Could not import the awarded projects.',
                    // An import can open a new session, so the page lands on the newest again.
                    'resets_scope' => true,
                ],
            ] : (object) [],
        ]);
    }
}
