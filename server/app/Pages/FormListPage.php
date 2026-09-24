<?php

namespace App\Pages;

use App\Models\User;

/**
 * One form type's list: a scholar's own forms as cards, anyone else's as a
 * table of the forms they may read, opened portal-wide or from one scholar's
 * record. Takes the route's form_type and roll_no.
 */
final class FormListPage extends PageDefinition
{
    /**
     * Forms a reviewer raises on a scholar's behalf, from that scholar's own
     * form list. The supervisor raises the list of examiners; the PhD
     * coordinator raises a supervisor change for a scholar who has not raised
     * it themselves. It is the ordinary form either way and still opens at the
     * scholar's step, because the preferences and the reason are theirs.
     */
    private const RAISED_FOR_A_SCHOLAR = [
        'list-of-examiners' => ['role' => 'faculty', 'label' => 'Create new form'],
        'supervisor-change' => ['role' => 'phd_coordinator', 'label' => 'Raise supervisor change'],
    ];

    public function allows(User $user): bool
    {
        // Each form's list answers who may read it; the page itself is everyone's.
        return true;
    }

    public function view(User $user, array $params = []): array
    {
        $role = $user->current_role?->role;
        $type = (string) ($params['form_type'] ?? '');
        $scholar = $params['roll_no'] ?? null;
        $raised = $scholar ? (self::RAISED_FOR_A_SCHOLAR[$type] ?? null) : null;

        // One place for the page's primary action, in the header beside the title.
        $create = fn (string $label, ?string $roll) => [
            'label' => $label,
            'request' => array_filter([
                'method' => 'POST',
                'path' => '{path}',
                'body' => $roll ? ['roll_no' => $roll] : null,
                'done' => null,
                'failure' => 'fetch',
                // The new form is on the list once the page is read again.
                'reload_page' => true,
            ], fn ($value) => $value !== null),
        ];
        $actions = match (true) {
            $role === 'student' => [$create('Create new form', null)],
            $raised && $role === $raised['role'] => [$create($raised['label'], '{roll_no}')],
            $role === 'faculty' && !$scholar && $type === 'list-of-examiners' => [self::action('Create new form', 'examiners')],
            default => [],
        };

        return self::page(self::title($type), $scholar ? 'Viewing {scholar}' : null, [
            'actions' => $actions,
            // A scholar reads their own forms as cards, not a table.
            ...($role === 'student'
                ? ['content' => ['block' => 'form-cards']]
                : ['table' => [
                    'endpoint' => '{path}',
                    'search' => (object) [],
                    'filters' => (object) [],
                    // Offered where the server says this reader may bulk-approve.
                    'approval' => true,
                    'select' => $role !== 'faculty' && $role !== 'admin',
                    'opens' => ['in_new_tab' => true],
                    // Only the PhD coordinator allocates supervisors, and only from
                    // the department-wide allocation list.
                    'toolbar' => $role === 'phd_coordinator' && !$scholar && $type === 'supervisor-allocation'
                        ? [self::action('Bulk allocate', 'bulk-allocate', 'secondary')] : [],
                    'actions' => [],
                ]]),
            'dialogs' => [
                'bulk-allocate' => ['block' => 'bulk-allocate', 'width' => '90vw'],
                'examiners' => ['block' => 'examiner-initiator', 'min_width' => '500px', 'max_width' => '600px', 'min_height' => '200px', 'max_height' => '400px'],
            ],
        ]);
    }

    /** The form type as a title: synopsis-submission reads "Synopsis submission", acronyms whole. */
    private static function title(string $type): string
    {
        $words = ucfirst(str_replace(['-', '_'], ' ', $type !== '' ? $type : 'Forms'));
        return preg_replace_callback('/\b(irb|urf|phd)\b/i', fn ($word) => strtolower($word[0]) === 'phd' ? 'PhD' : strtoupper($word[0]), $words);
    }
}
