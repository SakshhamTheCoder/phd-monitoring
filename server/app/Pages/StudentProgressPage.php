<?php

namespace App\Pages;

use App\Models\User;
use App\Support\Navigation;

/**
 * One scholar's progress monitoring, opened from their profile: the chart of
 * their evaluations over time, then every evaluation recorded. The scholar is
 * already chosen, so the semesters are the rows rather than the question, and
 * creating a semester or importing history belong to the office, not here.
 */
final class StudentProgressPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'scholars');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Progress monitoring', 'Every evaluation recorded for {scholar}.', [
            'above' => [['block' => 'progress-chart', 'props' => ['roll_no' => '{roll_no}']]],
            'table' => [
                'endpoint' => '/students/{roll_no}/forms/presentation',
                'select' => false,
                // The form lives under its semester; a row without one has no page to open.
                'opens' => ['navigate' => '/students/{roll_no}/forms/presentation/semester/{period}/{id}', 'requires' => 'period'],
                'actions' => [],
            ],
        ]);
    }
}
