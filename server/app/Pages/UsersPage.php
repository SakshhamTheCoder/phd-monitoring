<?php

namespace App\Pages;

use App\Http\Controllers\UserManagementController;
use App\Models\User;
use App\Support\Navigation;

/** Admin, Manage Users: accounts, their roles, and the sign-in links the office sends. */
final class UsersPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'admin');
    }

    public function view(User $user, array $params = []): array
    {
        $manages = $user->may('can_manage_users');
        // Accounts nobody has claimed yet: an import creates them without
        // mailing anybody, and the office sends the links when it is ready.
        $pending = $manages ? app(UserManagementController::class)->pendingSignInLinks()->getData(true) : null;
        $waiting = $pending['everyone']['count'] ?? 0;
        $full = ['close_outside' => false, 'width' => '80vw'];

        return self::page('Manage users', 'Create accounts and assign roles.', [
            // Who is waiting changes with the rows, so it is read again with them.
            'reload_with_table' => true,
            'actions' => $manages ? [
                ['label' => $waiting ? "Send sign-in links ({$waiting})" : 'Send sign-in links', 'variant' => 'quiet', 'disabled' => !$waiting, 'opens' => 'links'],
                self::action('Import from CSV', 'import', 'secondary'),
                self::action('Add user', 'add'),
            ] : [],
            'table' => array_filter([
                'endpoint' => '/users',
                'search' => ['path' => '/users'],
                // The row is a way into the edit form, so it follows the same
                // capability as the Edit action.
                'opens' => $manages ? ['dialog' => 'edit'] : null,
                'refresh' => 'in_place',
                'actions' => $manages ? [
                    ['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'edit'],
                    ['label' => 'Reset password', 'icon' => 'fa fa-key',
                        'prompt' => ['text' => 'Enter a new password for {name|this user} (min 8 characters):', 'key' => 'password', 'min' => 8, 'too_short' => 'Password must be at least 8 characters'],
                        'request' => ['method' => 'POST', 'path' => '/users/{id}/reset-password', 'done' => null, 'failure' => 'fetch', 'loader' => false, 'keeps_rows' => true]],
                    ['label' => 'Delete', 'icon' => 'fa fa-trash', 'request' => [
                        'method' => 'DELETE',
                        'path' => '/users/{id}',
                        'confirm' => 'Are you sure you want to delete {name|this user}? This action cannot be undone.',
                        'done' => null,
                        'failure' => 'fetch',
                        'loader' => false,
                    ]],
                ] : [],
            ], fn ($value) => $value !== null),
            'dialogs' => $manages ? [
                // Editing reads the whole account first.
                'edit' => $full + ['block' => 'user-editor', 'props' => ['edit' => true], 'load' => '/users/{id}'],
                // Creating starts by asking what kind of user, so the student or
                // faculty record is created with the login.
                'add' => [
                    'kind' => 'choice',
                    'close_outside' => false,
                    'width' => '520px',
                    'heading' => 'What kind of user is this?',
                    'intro' => "Picking the right kind creates the record the account needs, so the user isn't left with a role they can't use.",
                    'options' => [
                        ['opens' => 'add-student', 'icon' => 'fa-graduation-cap', 'title' => 'Student',
                            'description' => 'Creates the login and the student record together. Use for anyone enrolling in the PhD programme.'],
                        ['opens' => 'add-faculty', 'icon' => 'fa-id-badge', 'title' => 'Faculty',
                            'description' => 'Creates the login and the faculty record together, internal or external. HOD, PhD Coordinator and ADORDC are assigned later from the Departments page.'],
                        ['opens' => 'add-clerk', 'icon' => 'fa-id-card-o', 'title' => 'Clerk',
                            'description' => 'Creates a login for marking PhD attendance. Departments are tagged afterwards from Clerk Management.'],
                        ['opens' => 'add-other', 'icon' => 'fa-shield', 'title' => 'Office or admin',
                            'description' => 'A login with no student or faculty record, for Admin, Director, DRA, DORDC or a UG Student on the URF. These roles need no linked record.'],
                    ],
                ],
                'add-student' => $this->dialog($full, StudentFields::rows(edit: false), StudentFields::request(edit: false)),
                // The faculty form here has no Cancel; the dialog's own close is it.
                'add-faculty' => $this->dialog($full, FacultyPage::facultyRows(edit: false, cancel: false), FacultyPage::createRequest()),
                'add-clerk' => $this->dialog($full, ClerksPage::clerkRows(), ClerksPage::createRequest()),
                'add-other' => $full + ['block' => 'user-editor', 'props' => ['edit' => false]],
                'links' => ['title' => 'Send sign-in links', 'block' => 'sign-in-links', 'props' => $pending],
            ] : (object) [],
            'imports' => $manages ? [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import users from CSV',
                    'required' => ['full_name', 'email', 'role'],
                    'rules' => [
                        'Matched by email. An existing user is updated from the cells the row fills in.',
                        'gender is male, female or other. status is active, inactive or suspended.',
                        'available_roles is a comma separated list.',
                    ],
                    'sample' => ['name' => 'users_bulk_import_sample.csv', 'csv' => "full_name,email,phone,gender,role,available_roles,status\nKhalid Bashir,khalid.bashir.user@demo.invalid,9800000021,male,faculty,\"faculty,doctoral\",active"],
                    'path' => '/users/bulk-import',
                    'batch' => FacultyPage::STAFF_IMPORT,
                ],
            ] : (object) [],
        ]);
    }
}
