<?php

namespace App\Pages;

use App\Http\Controllers\UrfController;
use App\Models\UgBranch;
use App\Models\User;

/**
 * A UG student's home, laid out like the PhD student profile: their name with
 * their current URF project under it, their details below that, then that
 * project and the ones behind it. Roll number, branch and year come from what
 * they gave at sign-up, falling back to the current application for an
 * account the office created.
 */
final class UgProfilePage extends PageDefinition
{
    // Who they are is on a URF project once they apply, and the branch is what
    // routes a form to an ADORDC, so those rows say why rather than disappearing.
    private const LOCKED_NOTE = 'On a URF project now. Ask the office to change it.';

    private const EMPTY = 'N/A';

    public function allows(User $user): bool
    {
        return $user->may('can_apply_for_urf');
    }

    public function view(User $user, array $params = []): array
    {
        $mine = json_decode(json_encode(app(UrfController::class)->mine()->getData()), true);
        $account = $mine['account'] ?? [];
        $student = $mine['student'] ?? null;
        $applications = $mine['applications'] ?? [];
        $applied = count($applications) > 0;
        // The server sends the newest session first, so the current project leads.
        $current = $applications[0] ?? null;
        $past = array_slice($applications, 1);
        $slotOn = fn (?array $application) => $application && strtolower((string) ($application['student2_email'] ?? '')) === strtolower((string) ($account['email'] ?? '')) ? 2 : 1;
        $slot = $slotOn($current);
        $locked = fn (array $row) => $row + ($applied ? ['disabled' => true, 'hint' => self::LOCKED_NOTE] : []);

        $branches = UgBranch::ordered()->get(['id', 'programme', 'name'])
            ->map(fn ($branch) => ['title' => "{$branch->programme} {$branch->name}", 'value' => $branch->id])->all();
        $years = array_map(fn ($year) => ['title' => self::yearLabel($year), 'value' => $year], [1, 2, 3, 4]);

        return self::page(implode(' ', array_filter([$user->first_name, $user->last_name])), null, [
            // How to reach them stays theirs to correct; who they are becomes the
            // office's once they hold a project. Edits in place.
            'edit' => $student ? [
                'values' => [
                    'phone' => $account['phone'] ?? '',
                    'gender' => $account['gender'] ?? '',
                    'roll_no' => $student['roll_no'] ?? '',
                    'branch_id' => $student['branch_id'] ?? '',
                    'year' => $student['year'] ?? '',
                ],
                'request' => ['method' => 'PATCH', 'path' => '/urf/me', 'done' => 'Your details are saved', 'failure' => 'fetch', 'loader' => false],
                // The header reads the account stored at sign-in, so these follow it.
                'updates_user' => ['phone', 'gender'],
            ] : null,
            'sections' => array_values(array_filter([
                ['kind' => 'profile', 'lines' => [
                    ['label' => 'Current URF Project', 'title' => true, 'text' => $current ? "URF {$current['session']} · {$current['project_title']}" : null],
                    ['label' => 'Status', 'status' => $current['status'] ?? null],
                    ['label' => 'Faculty Mentors', 'links' => $current ? self::mentors($current) : null],
                ], 'rows' => [
                    $locked(['label' => 'Roll Number', 'value' => ($student['roll_no'] ?? null) ?: ($current["student{$slot}_roll_no"] ?? null), 'field' => 'roll_no']),
                    $locked(['label' => 'Branch', 'value' => ($student['branch']['name'] ?? null) ?: ($current["student{$slot}_branch"]['name'] ?? null), 'field' => 'branch_id', 'options' => $branches]),
                    $locked(['label' => 'Year', 'value' => self::yearLabel(($student['year'] ?? null) ?: ($current["student{$slot}_year"] ?? null)), 'field' => 'year', 'options' => $years]),
                    // Counted from the year rather than stored, so there is nothing to edit.
                    ['label' => 'Semester', 'value' => $student['semester_of_study'] ?? null],
                    ['label' => 'Email', 'value' => $account['email'] ?? null],
                    ['label' => 'Phone', 'value' => $account['phone'] ?? null, 'field' => 'phone'],
                    ['label' => 'Gender', 'value' => $account['gender'] ?? null, 'field' => 'gender', 'options' => [['title' => 'Male', 'value' => 'Male'], ['title' => 'Female', 'value' => 'Female']]],
                    ['label' => 'Programme', 'value' => $student['branch']['programme'] ?? null],
                ]],
                $current ? self::projects('Current URF project', [$current], $slotOn) : null,
                $past ? self::projects('Past URF projects', $past, $slotOn) : null,
            ])),
        ]);
    }

    /** A project table naming the other member only: this is the student's own profile. */
    private static function projects(string $title, array $applications, callable $slotOn): array
    {
        return [
            'kind' => 'table',
            'title' => $title,
            'columns' => [
                ['key' => 'session', 'title' => 'Session'],
                ['key' => 'project_title', 'title' => 'Project title'],
                ['key' => 'status', 'title' => 'Status', 'cell' => 'status'],
                ['key' => 'teammate', 'title' => 'Team member'],
                ['key' => 'teammate_branch', 'title' => 'Branch'],
                ['key' => 'teammate_year', 'title' => 'Year'],
                // Each mentor links to their own research profile, as names do elsewhere.
                ['key' => 'mentors', 'title' => 'Faculty mentors', 'cell' => 'faculty-links'],
            ],
            'rows' => array_map(function (array $application) use ($slotOn) {
                $other = $slotOn($application) === 1 ? 2 : 1;
                $teammate = $application["student{$other}_name"] ?? null;
                return [
                    'session' => $application['session'],
                    'project_title' => $application['project_title'],
                    'status' => $application['status'],
                    'teammate' => $teammate ?: self::EMPTY,
                    'teammate_branch' => ($teammate ? ($application["student{$other}_branch"]['name'] ?? null) : null) ?: self::EMPTY,
                    'teammate_year' => ($teammate ? self::yearLabel($application["student{$other}_year"] ?? null) : null) ?: self::EMPTY,
                    'mentors' => self::mentors($application),
                ];
            }, $applications),
        ];
    }

    private static function mentors(array $application): array
    {
        return array_map(fn ($mentor) => [
            'code' => $mentor['faculty_code'] ?? null,
            'name' => implode(' ', array_filter([$mentor['user']['first_name'] ?? null, $mentor['user']['last_name'] ?? null])),
        ], array_values(array_filter([$application['mentor1'] ?? null, $application['mentor2'] ?? null])));
    }

    /** "3rd Year" for 3, as the server names it. */
    private static function yearLabel(mixed $year): string
    {
        return $year ? $year . (['', 'st', 'nd', 'rd'][(int) $year] ?? 'th') . ' Year' : self::EMPTY;
    }
}
