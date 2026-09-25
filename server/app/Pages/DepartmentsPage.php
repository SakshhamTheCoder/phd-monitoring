<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\User;
use App\Support\Navigation;

/** Departments: each department, its HoD and its PhD coordinators. */
final class DepartmentsPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'departments');
    }

    public function view(User $user, array $params = []): array
    {
        // Every department write is gated on can_add_department server side, so
        // a role without it is shown the directory, not the controls.
        $manages = $user->may('can_add_department');

        return self::page('Departments', 'Departments, their HoD and PhD coordinators.', [
            'actions' => $manages ? [
                self::action('Import from CSV', 'import', 'secondary'),
                self::action('Add department', 'add'),
            ] : [],
            'table' => array_filter([
                'endpoint' => '/departments',
                'search' => ['path' => '/departments'],
                'opens' => $manages ? ['dialog' => 'manage'] : null,
                'actions' => $manages ? [
                    ['label' => 'Manage HOD and coordinators', 'icon' => 'fa fa-users', 'opens' => 'manage'],
                ] : [],
            ], fn ($value) => $value !== null),
            'dialogs' => $manages ? [
                'add' => $this->dialog(
                    ['width' => '90vw'],
                    [
                        self::heading('Add department'),
                        self::row([
                            Field::text('Department Name')->key('name')->value('')->hint('Enter department name...')->required()->trimmed()->open(),
                            Field::text('Department Code')->key('code')->value('')->hint('Enter department code...')->required()->trimmed()->open(),
                        ], space: 2),
                        self::buttons(
                            Field::submit('Add department')->requiresFilled(['name', 'code'], 'Please fill in both Department Name and Code'),
                            Field::cancel()->heldWhileSending(),
                        ),
                    ],
                    [
                        'method' => 'POST',
                        'path' => '/departments/add',
                        'done' => 'Department added successfully',
                        'done_from_answer' => true,
                        'failed' => 'Failed to add department',
                        // Pickers elsewhere share one kept list; the next one must see it.
                        'invalidates' => ['departments'],
                    ],
                ),
                // The HoD, ADoRDC and coordinators of the department opened.
                'manage' => ['block' => 'department-manager', 'width' => '90vw'],
            ] : (object) [],
            'imports' => $manages ? [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import departments from CSV',
                    'required' => ['Department Code'],
                    'rules' => [
                        'Departments are never created or deleted. A renamed code renames the department in place.',
                        'Officers are matched by their personal email. An office mailbox is reported and skipped.',
                        'The HOD and ADORDC office addresses are kept on the department, and a blank cell leaves the stored one alone.',
                        'Both coordinator cells blank leaves the current coordinators alone.',
                    ],
                    'sample' => ['name' => 'department_officers_sample.csv', 'csv' => implode("\n", [
                        'Department Code,HOD Name,HOD Personal Email,HOD Office Email,ADORDC Name,ADORDC Email,ADORDC Office Email,PhD Coordinator 1 Name,PhD Coordinator 1 Email,PhD Coordinator 2 Name,PhD Coordinator 2 Email,Clerk Name,Clerk Email,Clerk Phone',
                        'CSED,Hod One,hod.one@thapar.edu,hcsed@thapar.edu,Adordc One,adordc.one@thapar.edu,adorsp4@thapar.edu,Coordinator One,coordinator.one@thapar.edu,Coordinator Two,coordinator.two@thapar.edu,Clerk One,clerk.one@thapar.edu,9800000031',
                    ])],
                    'path' => '/departments/import',
                    'failed' => 'Import failed',
                    'invalidates' => ['departments'],
                ],
            ] : (object) [],
        ]);
    }
}
