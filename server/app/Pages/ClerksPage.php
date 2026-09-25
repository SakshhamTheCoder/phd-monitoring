<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\Department;
use App\Models\Role;
use App\Models\User;
use App\Support\Navigation;

/** Admin, Clerk management: clerk logins and the departments they mark attendance for. */
final class ClerksPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'admin');
    }

    public function view(User $user, array $params = []): array
    {
        $departments = Department::orderBy('name')->get()->map(fn ($department) => [
            'value' => $department->id,
            'title' => $department->name . ' ' . ($department->code ? "({$department->code})" : ''),
            // Drawn as separate words, as the page drew them: text split into
            // pieces is laid out a hair differently from the same text whole.
            'parts' => [$department->name, $department->code ? "({$department->code})" : ''],
        ])->all();

        return self::page('Clerk management', 'Create clerk logins and tag them with the departments whose PhD attendance they mark.', [
            'actions' => [
                self::action('Import from CSV', 'import', 'secondary'),
                self::action('Add clerk', 'add'),
            ],
            // The clerks endpoint is small and not paginated, so the list is read
            // whole and the filter bar filters it in the browser.
            'table' => [
                'kind' => 'local',
                'endpoint' => '/clerks',
                // The page answers to two addresses; the filters live at one of them.
                'search' => ['path' => '/clerks'],
                'class_prefix' => 'clerk',
                'loading' => 'Loading clerks',
                'failed' => 'Could not load the clerks. Check your connection and try again.',
                'empty' => 'No clerk accounts yet. Use Add clerk to create the first one.',
                'no_match' => 'No clerks match the current filters.',
                'columns' => [
                    ['key' => 'name', 'title' => 'Name'],
                    ['key' => 'email', 'title' => 'Email'],
                    ['key' => 'departments', 'title' => 'Departments', 'list_of' => 'name'],
                ],
                // A clerk can be tagged with several departments, so this filter
                // matches any one of them.
                'lists' => ['department.name' => ['list' => 'departments', 'key' => 'name']],
                'actions' => [
                    ['label' => 'Manage departments', 'icon' => 'fa fa-users', 'opens' => 'departments'],
                ],
            ],
            'dialogs' => [
                'add' => $this->dialog(['close_outside' => false, 'width' => '80vw'], self::clerkRows(), self::createRequest()),
                'departments' => $this->dialog(
                    ['title' => 'Departments for {name}', 'close_outside' => false, 'width' => '560px'],
                    [
                        self::paragraph("Select every department this clerk marks attendance for. Saved departments are the only ones whose scholars appear on the clerk's attendance roster.", 'modal-note'),
                        Field::checks('', $departments)->key('department_ids')->value([])->fromPlucked('departments', 'department_id')
                            ->with(['class_name' => 'clerk-dept', 'grid_class' => 'clerk-dept-grid', 'empty' => 'No departments yet.', 'empty_class' => 'clerk-none'])->open(),
                        self::buttons('Save'),
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/clerks/{id}/departments',
                        'done' => 'Departments updated.',
                        'done_from_answer' => true,
                        'failure' => 'fetch',
                        'loader' => false,
                    ],
                ),
            ],
            'imports' => [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import clerks from CSV',
                    'required' => ['email'],
                    'rules' => [
                        'Matched by email. A clerk is created when the email is not found.',
                        'department_codes is a comma separated list, for example "CSED, CHED".',
                        "A blank department_codes leaves the clerk's current departments alone.",
                    ],
                    'sample' => ['name' => 'clerk_bulk_import_sample.csv', 'csv' => "email,phone,department_codes,full_name\nclerk.one@demo.invalid,9800000031,\"CSED, CHED\",Anita Desai"],
                    'path' => '/clerks/bulk-update',
                    'batch' => [
                        'size' => 50,
                        'loader' => false,
                        'reports_failures' => true,
                        'summary' => '{created} created, {updated} updated, {errors} errors.',
                        'done' => 'Import completed: {summary}',
                        'none' => 'Nothing was imported: {summary}',
                        'failed' => 'Batch {n} failed.',
                        'crashed' => 'Failed to import CSV.',
                    ],
                ],
            ],
        ]);
    }

    /** Creating a clerk's login: a clerk has no student or faculty record. */
    public static function clerkRows(bool $cancel = false): array
    {
        $clerkRole = Role::where('role', 'clerk')->value('id');

        return [
            self::heading('Create clerk'),
            self::paragraph('A clerk has no student or faculty record. Departments are tagged afterwards from this page.', 'modal-note modal-note--flush'),
            self::row([Field::text('Full name*')->key('full_name')->value('')->open()]),
            self::row([Field::text('Email*')->key('email')->value('')->open(), Field::text('Phone*')->key('phone')->value('')->open()], space: 2, ratio: [2, 1]),
            self::row([
                Field::select('Gender', [['title' => 'Male', 'value' => 'Male'], ['title' => 'Female', 'value' => 'Female']])->key('gender')->value('')->nullIfEmpty()->open(),
                Field::select('Status', [['value' => 'active', 'title' => 'Active'], ['value' => 'inactive', 'title' => 'Inactive']])->key('status')->value('active')->open(),
            ]),
            self::row([Field::text('Custom password (optional, min 8 characters)')->key('password')->value('')->inputType('password')->sentOnlyIfFilled()->open()]),
            self::paragraph('Leave empty and they are emailed a link to set their own.', 'field-help'),
            Field::hidden('role_id')->value($clerkRole)->open(),
            Field::hidden('current_role_id')->value($clerkRole)->open(),
            Field::hidden('default_role_id')->value($clerkRole)->open(),
            Field::hidden('available_roles')->value(['clerk'])->open(),
            self::buttons(
                Field::submit('Add clerk')->requiresNamed(['full_name' => 'Full Name', 'email' => 'Email', 'phone' => 'Phone'], 'Please fill required fields: '),
                $cancel ? 'Cancel' : null,
            ),
        ];
    }

    /** Where a new clerk is sent, and what the answer says. */
    public static function createRequest(): array
    {
        return [
            'method' => 'POST',
            'path' => '/users',
            'done' => 'Clerk created. They are emailed a link to set their password.',
            // A password chosen here comes back, and is shown once.
            'answer_says' => [['key' => 'password', 'text' => 'Clerk created. Password: {password}']],
            'warnings_from' => 'warnings',
            'failure' => 'fetch',
            'loader' => false,
        ];
    }
}
