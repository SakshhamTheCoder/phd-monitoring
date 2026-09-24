<?php

namespace App\Pages;

use App\Models\UrfApplication;
use App\Models\User;
use App\Support\Navigation;

/**
 * Admin, URF, one form: who filled it in, listed the way the PhD form lists
 * are, one session at a time so a list never mixes two years.
 */
final class UrfFormListPage extends PageDefinition
{
    public const FORMS = [
        'urf-application' => 'URF Application Form',
        'urf-additional-info' => 'Additional Information Form',
        'urf-half-yearly-report' => 'Half-yearly Progress Report',
        'urf-final-report' => 'Final Report',
    ];

    public function __construct(private readonly string $form)
    {
    }

    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'urf');
    }

    public function view(User $user, array $params = []): array
    {
        // Scoped to what the reader may read: the office gets every year, a
        // mentor the years they mentor in. The newest is the one to land on.
        $reads = !empty(Navigation::capabilities($user)['can_read_urf_mentees']);
        $sessions = $reads ? UrfApplication::query()
            ->unless($user->may('can_manage_urf'), fn ($q) => $q->mentoredBy($user->faculty?->faculty_code))
            ->distinct()->orderByDesc('session')->pluck('session')->values()->all() : [];

        return self::page(self::FORMS[$this->form], 'Undergraduate Research Fellowship', [
            'scope' => self::sessionScope($sessions),
            'table' => [
                'endpoint' => "/urf/{$this->form}",
                'search' => [
                    'path' => "/urf/{$this->form}",
                    'placeholder' => 'Search by project, student, roll no or mentor…',
                    'exclude' => ['session'],
                ],
                'select' => false,
                'filters' => ['conditions' => []],
                // A row opens that submission's own page, with its chain.
                'opens' => ['navigate' => "/urf/{$this->form}/{id}"],
                'actions' => [],
            ],
        ]);
    }

    /**
     * The session a URF list is read for, picked in the page's header; with no
     * sessions there is nothing to pick and the list is not narrowed.
     */
    public static function sessionScope(array $sessions): array
    {
        return [
            'key' => 'session',
            'value' => $sessions ? (string) $sessions[0] : '',
            'options' => array_map(fn ($year) => ['value' => (string) $year, 'title' => "URF {$year}"], $sessions),
            'class_name' => 'urf-session-picker',
        ];
    }
}
