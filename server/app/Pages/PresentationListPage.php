<?php

namespace App\Pages;

use App\Models\User;
use App\Support\Navigation;

/**
 * One semester's progress monitoring: the semester's figures, then its
 * evaluations by what they need (a scholar sees only their own). Opened
 * portal-wide or from one scholar's record, on the path it is read from.
 */
final class PresentationListPage extends PageDefinition
{
    private const ACTION = 0;
    private const NOT_SCHEDULED = 3;
    private const ALL = 6;

    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'presentations');
    }

    public function view(User $user, array $params = []): array
    {
        $role = $user->current_role?->role ?? 'student';
        $stats = ['block' => 'semester-stats', 'props' => ['semester' => '{semester_id}'], 'controls_search' => true];

        if ($role === 'student') {
            return self::page('Progress monitoring list', null, [
                'above' => [$stats],
                'table' => ['endpoint' => '{path}', 'filters' => (object) [], 'approval' => true, 'opens' => ['in_new_tab' => true], 'actions' => []],
            ]);
        }

        // Admin reads every evaluation but reviews none, so nothing waits on
        // it, and it opens on everything. Not scheduled is read by the roles
        // SemesterController::notScheduled answers.
        $reviewsNothing = $role === 'admin';
        $readsNotScheduled = in_array($role, ['hod', 'phd_coordinator', 'faculty', 'dordc', 'admin'], true);
        $only = fn (string $key, int $value, ?string $op = null) => ['mandatory_filter' => [array_filter(['key' => $key, 'op' => $op, 'value' => $value], fn ($part) => $part !== null)]];

        $tabs = [
            self::ACTION => ['label' => 'Action required', 'filters' => $only('action', 1), 'approval' => true],
            1 => ['label' => 'Upcoming progress monitoring', 'filters' => $only('upcoming', 1)],
            2 => ['label' => 'Completed', 'filters' => $only('missed', 0, '=')],
            self::NOT_SCHEDULED => ['label' => 'Not scheduled', 'endpoint' => '{path}/not-scheduled'],
            // Semester off never had a filter behind it, so it is not offered.
            5 => ['label' => 'Not submitted', 'filters' => $only('missed', 1)],
            self::ALL => ['label' => 'All progress monitoring', 'shows_search' => true],
        ];
        if ($reviewsNothing) {
            unset($tabs[self::ACTION]);
        }
        if (!$readsNotScheduled) {
            unset($tabs[self::NOT_SCHEDULED]);
        }

        return self::page('Progress monitoring list', null, [
            'above' => [$stats],
            'tabs_place' => 'body',
            'tabs' => array_values(array_map(fn ($value, $tab) => [
                'value' => $value,
                'label' => $tab['label'],
                'shows_search' => $tab['shows_search'] ?? false,
                'actions' => [],
                'table' => [
                    'endpoint' => $tab['endpoint'] ?? '{path}',
                    'filters' => $tab['filters'] ?? (object) [],
                    'approval' => $tab['approval'] ?? false,
                    'select' => $tab['approval'] ?? false,
                    // One table across the tabs, as the page drew it.
                    'keep_on_tab' => true,
                    // A row opens its form in a new tab, from the list's own path.
                    'opens' => ['in_new_tab' => true],
                    'search' => ['keyed_by_tab' => true],
                    'actions' => [],
                ],
            ], array_keys($tabs), $tabs)),
            'tab' => $reviewsNothing ? self::ALL : self::ACTION,
        ]);
    }
}
