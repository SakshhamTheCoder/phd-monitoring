<?php

namespace App\Pages;

use App\Forms\Field;
use App\Http\Controllers\DepartmentController;
use App\Models\Department;
use App\Models\User;
use App\Support\Navigation;

/** Areas of Specialization: the research areas each department offers. */
final class AreasPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'areasOfSpecialization');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Areas of specialization', 'The research areas each department offers.', [
            'actions' => [
                self::action('Import from CSV', 'import', 'secondary'),
                self::action('Add area', 'add'),
            ],
            'table' => [
                'endpoint' => '/departments/area-of-specialization/list',
                'search' => ['path' => '/departments/area-of-specialization'],
                'opens' => ['dialog' => 'edit'],
                'actions' => [
                    ['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'edit'],
                    ['label' => 'Delete', 'icon' => 'fa fa-trash', 'request' => [
                        'method' => 'DELETE',
                        'path' => '/departments/area-of-specialization/delete/{id}',
                        'confirm' => 'Are you sure you want to delete this area of specialization?',
                        'done' => 'Area deleted.',
                        'failed' => 'Failed to delete area.',
                    ]],
                ],
            ],
            'dialogs' => [
                'add' => $this->dialog(
                    ['title' => 'Add area of specialization', 'close_outside' => false, 'min_width' => '600px', 'max_width' => '800px'],
                    [...$this->areaRows($user), self::buttons($this->send('Add'))],
                    ['method' => 'POST', 'path' => '/departments/area-of-specialization/add', 'done' => 'Area added.', 'failed' => 'Failed to add area.'],
                ),
                'edit' => $this->dialog(
                    ['title' => 'Edit area of specialization', 'close_outside' => false, 'min_width' => '600px', 'max_width' => '800px'],
                    [...$this->areaRows($user), self::buttons($this->send('Update'))],
                    ['method' => 'PUT', 'path' => '/departments/area-of-specialization/update/{id}', 'done' => 'Area updated.', 'failed' => 'Failed to update area.'],
                ),
            ],
            'imports' => [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import research areas from CSV',
                    'required' => ['name', 'department_code'],
                    'rules' => [
                        "The institute's matrix also loads as it is: one column per department code, one area per cell.",
                        'An area already on the list is left alone, so the same file can be loaded twice.',
                        'An area the sheet drops is removed only when no scholar or faculty member points at it.',
                    ],
                    'sample' => ['name' => 'research_areas_sample.csv', 'csv' => "name,department_code\nMachine Learning,CSED\nData Science,CSED"],
                    'path' => '/departments/area-of-specialization/import',
                    // The server says which departments the sheet replaces before it does.
                    'confirm_first' => true,
                    'failed' => 'Failed to import areas',
                ],
            ],
        ]);
    }

    /** The send button, which refuses an empty name or department. */
    private function send(string $label): Field
    {
        return Field::submit($label)->requiresAll(['name', 'department_id'], 'Name and Department are required');
    }

    /**
     * An area's name and department. The server keeps a HoD or coordinator to
     * their own department, so for them the department is fixed to it.
     */
    private function areaRows(User $user): array
    {
        $scoped = in_array($user->current_role?->role, ['hod', 'phd_coordinator'], true);
        $own = $scoped ? Department::find(DepartmentController::areaWriteDepartmentId($user)) : null;
        $options = $scoped
            ? ($own ? [['title' => $own->name, 'value' => $own->id]] : [])
            : Department::orderBy('name')->get()->map(fn ($department) => ['title' => $department->name, 'value' => $department->id])->all();

        $department = Field::select('Department', $options)->key('department_id')->value($scoped ? ($own?->id ?? '') : '')->from('department_id');
        $department = $scoped ? $department->lockedIf(true)->alwaysSent() : $department;

        return [
            self::row([
                Field::text('Area Name')->key('name')->hint('e.g., Machine Learning, Data Science')->value('')->from('name')->open(),
                $department->open(),
            ]),
        ];
    }
}
