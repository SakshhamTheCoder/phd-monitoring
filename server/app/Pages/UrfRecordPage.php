<?php

namespace App\Pages;

use App\Http\Controllers\UrfController;
use App\Models\User;
use App\Support\Navigation;

/**
 * Admin, URF, one project: its facts, one card per form it holds, its team
 * and, for a reviewer, each student's other URF projects. The values are
 * worked out here, so every client shows the same words. Takes the route's id.
 */
final class UrfRecordPage extends PageDefinition
{
    private const STEP_NAMES = [
        'student' => 'the student',
        'mentor' => 'the faculty mentor',
        'adordc' => 'the ADORDC',
        'dordc' => 'the DORDC',
        'complete' => 'nobody, it is through',
    ];

    private const REPORT_TYPES = ['half_yearly' => 'Half-yearly Progress Report', 'final' => 'Final Report'];

    // The kinds of publication the portal records. It has no Scopus flag, so a
    // reviewer reads eligibility from these.
    private const PUBLICATION_KINDS = [
        'journal:sci' => 'SCI journal',
        'journal:non-sci' => 'Non-SCI journal',
        'conference:international' => 'International conference',
        'conference:national' => 'National conference',
    ];

    private const FINAL_REPORT = ['approved' => 'Approved', 'filed' => 'Filed, in review'];

    private const EMPTY = 'N/A';

    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'urf');
    }

    public function view(User $user, array $params = []): array
    {
        // The project as its own endpoint answers this reader, refusals included.
        $answer = app(UrfController::class)->show($params['id'] ?? 0);
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        $record = json_decode(json_encode($answer->getData()), true);

        // An application is decided once: selected or rejected, and only by
        // those the server lets decide.
        $decides = !empty($record['can_decide']) && ($record['status'] ?? null) === 'applied';

        return self::page((string) $record['project_title'], null, [
            'actions' => $decides ? [
                self::action('Select', 'select'),
                self::action('Reject', 'reject', 'secondary'),
            ] : [],
            'sections' => array_values(array_filter([
                ['kind' => 'facts', 'title' => 'Project', 'facts' => [
                    ['label' => 'Status', 'text' => self::capitalize($record['status'] ?? ''), 'span' => true],
                    ['label' => 'Session', 'text' => !empty($record['session']) ? "URF {$record['session']}" : null],
                    ['label' => 'Applied on', 'date' => $record['applied_on'] ?? null],
                    ['label' => 'Approval', 'text' => self::stageLine($record)],
                    // Beside the facts, not with the decisions, so it never reads as one of them.
                    ['label' => 'Proposal', 'file' => $record['proposal'] ?? null, 'button' => 'View proposal'],
                ]],
                ['kind' => 'forms', 'title' => 'Forms', 'forms' => self::forms($record)],
                ['kind' => 'panel', 'parts' => array_values(array_filter([
                    self::table('Team members', ['name' => 'Name', 'roll_no' => 'Roll number', 'branch' => 'Branch', 'year' => 'Year', 'gender' => 'Gender', 'email' => 'Official email', 'phone' => 'Phone'], self::students($record)),
                    self::table('Faculty mentors', ['name' => 'Name', 'email' => 'Email', 'designation' => 'Designation', 'department' => 'Department'], self::mentors($record), ['name' => 'faculty']),
                    isset($record['other_projects'])
                        ? self::table('Eligibility: other URF projects', ['student' => 'Student', 'session' => 'Session', 'project_title' => 'Project', 'status' => 'Status', 'final_report' => 'Final report', 'publications' => 'Publications'], self::otherProjects($record['other_projects']))
                        : null,
                ]))],
            ])),
            'dialogs' => $decides ? [
                'select' => self::decision($record, 'selected', 'Select'),
                'reject' => self::decision($record, 'rejected', 'Reject'),
            ] : (object) [],
        ]);
    }

    /** Every change notifies the students, so it is confirmed before it is sent. */
    private static function decision(array $record, string $status, string $label): array
    {
        return [
            'kind' => 'confirm',
            'title' => $label,
            'min_height' => '140px',
            'max_width' => '460px',
            'text' => ['Mark “', (string) $record['project_title'], '” as ', ['strong' => $status], '? The students on the project are notified.'],
            'button' => $label,
            'request' => ['method' => 'POST', 'path' => "/urf/{$record['id']}/status", 'body' => ['status' => $status], 'done' => "Project marked {$status}", 'failure' => 'fetch', 'loader' => false],
        ];
    }

    /** Where the project stands: whom it waits on, or how it was closed. */
    private static function stageLine(array $record): string
    {
        $stage = $record['stage'] ?? null;
        if ($stage !== 'complete') {
            return 'Waiting on ' . (self::STEP_NAMES[$stage] ?? 'the student') . '.';
        }
        $last = $record['history'] ? end($record['history']) : null;
        if (($last['step'] ?? null) === 'office') {
            return implode(' ', array_filter([(($last['decision'] ?? null) === 'rejected' ? 'Rejected' : 'Selected') . ' by the office.', $last['comments'] ?? null]));
        }
        if (($last['decision'] ?? null) === 'reject') {
            return 'Rejected by ' . (self::STEP_NAMES[$last['step'] ?? ''] ?? 'the DORDC') . '.';
        }
        return 'Approved by the mentor, the ADORDC and the DORDC.';
    }

    /** The project's forms, each opening its own page, lit where one waits on the reader. */
    private static function forms(array $record): array
    {
        $type = fn (array $report) => $report['type'] === 'final' ? 'urf-final-report' : 'urf-half-yearly-report';
        return [
            ['form_type' => 'urf-application', 'form_name' => 'URF Application Form', 'path' => "/urf/urf-application/{$record['id']}", 'action_required' => $record['awaiting_me'] ?? false],
            // A fellow row a reader is not entitled to is left out of the payload.
            ...array_map(fn ($fellow) => ['form_type' => 'urf-additional-info', 'form_name' => 'Additional Information Form', 'path' => "/urf/urf-additional-info/{$fellow['id']}", 'action_required' => $fellow['awaiting_me'] ?? false], $record['fellows'] ?? []),
            ...array_map(fn ($report) => ['form_type' => $type($report), 'form_name' => self::REPORT_TYPES[$report['type']] ?? 'Report', 'path' => "/urf/{$type($report)}/{$report['id']}", 'action_required' => $report['awaiting_me'] ?? false], $record['reports'] ?? []),
        ];
    }

    private static function students(array $record): array
    {
        $rows = [];
        foreach ([1, 2] as $n) {
            if (empty($record["student{$n}_name"])) {
                continue;
            }
            $rows[] = [
                'name' => $record["student{$n}_name"],
                'roll_no' => $record["student{$n}_roll_no"] ?? null,
                'branch' => $record["student{$n}_branch"]['name'] ?? self::EMPTY,
                'year' => self::yearLabel($record["student{$n}_year"] ?? null),
                'gender' => $record["student{$n}_gender"] ?? null,
                'email' => $record["student{$n}_email"] ?? null,
                'phone' => $record["student{$n}_phone"] ?? null,
            ];
        }
        return $rows;
    }

    private static function mentors(array $record): array
    {
        return array_map(fn ($mentor) => [
            'faculty_code' => $mentor['faculty_code'] ?? null,
            'name' => implode(' ', array_filter([$mentor['user']['first_name'] ?? null, $mentor['user']['last_name'] ?? null])),
            'email' => $mentor['user']['email'] ?? null,
            'designation' => $mentor['designation'] ?? null,
            'department' => $mentor['department']['name'] ?? self::EMPTY,
        ], array_values(array_filter([$record['mentor1'] ?? null, $record['mentor2'] ?? null])));
    }

    /**
     * Each student's other URF projects and what came of them, so a reviewer
     * can weigh eligibility: a student who finished a fellowship without
     * publishing may not be eligible again.
     */
    private static function otherProjects(array $students): array
    {
        $rows = [];
        foreach ($students as $entry) {
            if (!$entry['projects']) {
                $rows[] = ['student' => $entry['student'], 'session' => self::EMPTY, 'project_title' => 'No other URF project', 'status' => self::EMPTY, 'final_report' => self::EMPTY, 'publications' => self::EMPTY];
                continue;
            }
            foreach ($entry['projects'] as $project) {
                $rows[] = [
                    'student' => $entry['student'],
                    'session' => "URF {$project['session']}",
                    'project_title' => $project['project_title'],
                    'status' => self::capitalize($project['status'] ?? ''),
                    'final_report' => self::FINAL_REPORT[$project['final_report'] ?? ''] ?? 'Not filed',
                    'publications' => self::publications($project['publications'] ?? []),
                ];
            }
        }
        return $rows;
    }

    private static function publications(array $counts): string
    {
        $parts = [];
        foreach ($counts as $kind => $n) {
            $parts[] = "{$n} " . (self::PUBLICATION_KINDS[$kind] ?? (str_starts_with($kind, 'book') ? 'Book' : $kind));
        }
        return $parts ? implode(', ', $parts) : 'None linked';
    }

    /** "3rd Year" for 3, as the server names it. */
    private static function yearLabel(mixed $year): string
    {
        if (!$year) {
            return self::EMPTY;
        }
        return $year . (['', 'st', 'nd', 'rd'][(int) $year] ?? 'th') . ' Year';
    }

    private static function capitalize(string $text): string
    {
        return $text === '' ? '' : strtoupper($text[0]) . substr($text, 1);
    }

    /** A labelled table, three columns wide, as a record's panels draw one. */
    private static function table(string $label, array $columns, array $rows, array $cells = []): array
    {
        return array_filter([
            'kind' => 'table',
            'label' => $label,
            'space' => 3,
            'columns' => array_map(fn ($key, $title) => ['key' => $key, 'title' => $title], array_keys($columns), $columns),
            'rows' => $rows,
            'cells' => $cells ?: null,
        ], fn ($value) => $value !== null);
    }
}
