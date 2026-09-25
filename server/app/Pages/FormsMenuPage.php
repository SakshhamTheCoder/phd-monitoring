<?php

namespace App\Pages;

use App\Models\User;
use App\Support\Navigation;

/**
 * The forms menu a reviewer opens from the sidebar: one card per form type,
 * each leading to that form's list of the forms they may read.
 */
final class FormsMenuPage extends PageDefinition
{
    private const FORMS = [
        'supervisor-allocation' => 'Supervisor Allocation',
        'status-change' => 'Status Change',
        'irb-constitution' => 'IRB Constitution',
        'semester-off' => 'Semester Off',
        'irb-submission' => 'Revised IRB Submission',
        'irb-extension' => 'IRB Extension',
        'synopsis-submission' => 'Synopsis Submission',
        'supervisor-change' => 'Supervisor Change',
        'list-of-examiners' => 'List of Examiners',
        'thesis-extension' => 'Thesis Extension',
        'thesis-submission' => 'Thesis Submission',
        'revise-title' => 'Revised Title or Objectives',
    ];

    public function allows(User $user): bool
    {
        // The roles that read scholars' forms; a scholar's own are a page of their own.
        return Navigation::allows($user, 'scholars');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Forms', null, [
            'forms' => array_map(fn ($type, $name) => ['form_type' => $type, 'form_name' => $name], array_keys(self::FORMS), self::FORMS),
        ]);
    }
}
