<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\User;
use App\Support\Navigation;

/** Admin, Outside Experts: the directory of external examiners and experts. */
final class OutsideExpertsPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'admin');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Outside experts', 'External examiners and experts available to committees.', [
            'actions' => [
                self::action('Import from CSV', 'import', 'secondary'),
                self::action('Add outside expert', 'add'),
            ],
            'table' => [
                'endpoint' => '/outside-experts/list',
                'search' => ['path' => '/outside-experts'],
                // No detail page for an expert; editing is in the row menu.
                'actions' => [
                    ['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'edit'],
                    ['label' => 'Delete', 'icon' => 'fa fa-trash', 'request' => [
                        'method' => 'DELETE',
                        'path' => '/outside-experts/delete/{id}',
                        'confirm' => 'Are you sure you want to delete this outside expert?',
                        'done' => 'Outside expert deleted successfully',
                        'failed' => 'Failed to delete outside expert',
                        'failure' => 'errors',
                    ]],
                ],
            ],
            'dialogs' => [
                'add' => $this->dialog(
                    ['title' => 'Add new outside expert', 'close_outside' => false],
                    [...self::expertRows(), self::buttons('Add expert')],
                    ['method' => 'POST', 'path' => '/outside-experts/add', 'done' => 'Outside expert added successfully', 'failed' => 'Failed to add outside expert', 'failure' => 'errors'],
                ),
                'edit' => $this->dialog(
                    ['title' => 'Edit outside expert', 'close_outside' => false],
                    [...self::expertRows(), self::buttons('Update expert')],
                    ['method' => 'PUT', 'path' => '/outside-experts/update/{id}', 'done' => 'Outside expert updated successfully', 'failed' => 'Failed to update outside expert', 'failure' => 'errors'],
                ),
            ],
            'imports' => [
                'import' => [
                    'kind' => 'file',
                    'title' => 'Import outside experts from CSV',
                    'columns' => ['full_name', 'email', 'phone', 'designation', 'department', 'institution', 'area_of_expertise', 'website'],
                    'note' => 'Note: Phone, area_of_expertise, and website are optional. If an expert with the same email exists, their record will be updated.',
                    'path' => '/outside-experts/bulk-import',
                ],
            ],
        ]);
    }

    /**
     * One expert's fields. The server requires name, email, designation,
     * department and institution; the rest are optional.
     */
    public static function expertRows(): array
    {
        $text = fn (string $label, string $key, string $hint) => Field::text($label)->key($key)->hint($hint)->value('')->open();

        return [
            self::row([$text('Full Name', 'full_name', 'e.g. Dr. Tarunpreet Bhatia')->required()->from('name', ['first_name', 'last_name'])]),
            self::row([
                $text('Email', 'email', 'expert@example.com')->inputType('email')->required()->from('email'),
                $text('Phone', 'phone', 'Enter phone number')->from('phone'),
            ]),
            self::row([
                $text('Designation', 'designation', 'e.g., Professor')->required()->from('designation'),
                $text('Department', 'department', 'e.g., Computer Science')->required()->from('department'),
            ]),
            self::row([$text('Institution', 'institution', 'e.g., University Name')->required()->from('institution')], space: 2),
            self::row([$text('Area of Expertise', 'area_of_expertise', 'Research areas')->from('area_of_expertise')], space: 2),
            self::row([$text('Website', 'website', 'https://example.com')->from('website')], space: 2),
        ];
    }
}
