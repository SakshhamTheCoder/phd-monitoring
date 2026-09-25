<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\UgBranch;
use App\Models\User;
use App\Support\Navigation;

/** Students: PhD scholars, and the URF's UG students on a tab of their own. */
final class StudentsPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'scholars');
    }

    public function view(User $user, array $params = []): array
    {
        $managesStudents = $user->may('can_manage_students');
        $managesUrf = $user->may('can_manage_urf');
        // A mentor reads the UG students on the projects they mentor, so the tab
        // is theirs too, while they mentor something (as /me says). Adding,
        // importing and editing one stay the office's.
        $readsUrf = !empty(Navigation::capabilities($user)['can_read_urf_mentees']);

        $phd = [
            // Adding and importing belong to the list on screen, so they follow the tab.
            'actions' => $managesStudents ? [
                self::action('Bulk import', 'import', 'secondary'),
                self::action('Add student', 'add'),
            ] : [],
            'table' => [
                'endpoint' => '/students',
                'search' => ['path' => '/students'],
                // The row opens the scholar's profile in a new tab.
                'opens' => ['in_new_tab' => true],
                'filters' => [],
                'actions' => [
                    ...($managesStudents ? [['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'edit']] : []),
                    ...($user->may('can_propose_supervisor_changes')
                        ? [['label' => 'Manage supervisors/doctoral', 'icon' => 'fa fa-users', 'opens' => 'supervisors']] : []),
                    // Manage Forms has no capability of its own yet, so it keeps
                    // the role check it always had.
                    ...($user->current_role?->role === 'admin'
                        ? [['label' => 'Manage forms', 'icon' => 'fa fa-file-text-o', 'navigate' => '/forms/manage?roll_no={roll_no}']] : []),
                ],
            ],
        ];

        $ug = [
            'actions' => $managesUrf ? [
                self::action('Bulk import', 'ug-import', 'secondary'),
                self::action('Add UG student', 'ug-add'),
            ] : [],
            'table' => [
                'endpoint' => '/ug-students',
                'search' => ['path' => '/ug-students', 'placeholder' => 'Search by name, roll number or branch…'],
                // UG students have no profile page; editing is in the row menu.
                'select' => false,
                'filters' => ['conditions' => []],
                'actions' => $managesUrf ? [['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'ug-edit']] : [],
            ],
        ];

        $student = ['close_outside' => false, 'width' => '80vw'];
        $ugDialog = ['close_outside' => false, 'width' => '60vw', 'wrapped' => true];

        return self::page('Students', 'All PhD scholars and their current stage.', [
            ...($readsUrf
                ? ['tabs' => [
                    ['value' => 'phd', 'label' => 'PhD scholars'] + $phd,
                    ['value' => 'ug', 'label' => 'UG students'] + $ug,
                ]]
                : $phd),
            'dialogs' => [
                ...($managesStudents ? [
                    'add' => $this->dialog($student, StudentFields::rows(edit: false), StudentFields::request(edit: false)),
                    'edit' => $this->dialog($student, StudentFields::rows(edit: true), StudentFields::request(edit: true)),
                ] : []),
                ...($user->may('can_propose_supervisor_changes') ? [
                    'supervisors' => ['block' => 'supervisor-doctoral-manager'],
                ] : []),
                ...($managesUrf ? [
                    'ug-add' => $this->dialog($ugDialog + ['title' => 'Add UG student'], self::ugRows(edit: false), [
                        'method' => 'POST', 'path' => '/ug-students',
                        'done' => 'Student added. They have been emailed a link to set their password.',
                        'failure' => 'fetch', 'loader' => false,
                    ]),
                    'ug-edit' => $this->dialog($ugDialog + ['title' => 'Edit UG student'], self::ugRows(edit: true), [
                        'method' => 'PATCH', 'path' => '/ug-students/{id}',
                        'done' => 'Student updated',
                        'failure' => 'fetch', 'loader' => false,
                    ]),
                ] : []),
            ] ?: (object) [],
            'imports' => [
                ...($managesStudents ? ['import' => [
                    'kind' => 'rows',
                    'title' => 'Bulk import students',
                    'required' => ['Registration Number', 'Full Name', 'Email', 'Phone', 'Department Code', 'Date of Admission', 'Enrollment Type'],
                    'rules' => [
                        'Matched by registration number, then email. Both must belong to the same scholar.',
                        "A blank cell never clears a stored value. Clear one on the scholar's profile.",
                        'Supervisors and committee: filled cells replace the whole list, all blank leaves it alone.',
                        'Enrollment Type reads REG, PT and Exec as well as Full Time, Part Time and Executive.',
                        'Nobody is mailed. Use Send sign-in links when the scholars are ready to be told.',
                        'IRB members and the external expert go on the IRB committee only. The doctoral committee is a separate body, filled from its own columns.',
                        'Named supervisors, a Date of IRB, of Synopsis and of Thesis each record that milestone as done, which opens the forms that come after it.',
                        'Those forms are created complete and locked, and nothing in them is recorded as approved, because nobody approved them here.',
                    ],
                    'sample' => ['name' => 'students_bulk_import_sample.csv', 'csv' => implode("\n", [
                        'Registration Number,Full Name,Email,Phone,Department Code,Father Name,Gender,Enrollment Type,Date of Admission,Date of IRB,Date of Synopsis,Date of Thesis,Date of thesis awarded,CGPA,Overall Progress,PhD Title,NET/Gate,JRF?,Permanent Address,Supervisor 1 Name,Supervisor 1 Email,Supervisor 2 Name,Supervisor 2 Email,Supervisor 3 Name,Supervisor 3 Email,Committee Member 1 Name,Committee Member 1 Email,Committee Member 2 Name,Committee Member 2 Email,Committee Member 3 Name,Committee Member 3 Email,IRB member1 email,IRB member2 email,IRB member3 email,External expert for IRB Name,External expert for IRB Mail,External expert for IRB Designation,External expert for IRB Department,External expert for IRB Institute name',
                        '900011,Scholar One,scholar.one@demo.invalid,9800000011,CSED,Parent One,Female,Full Time,2024-08-01,,,,,8.4,10,,Yes,Yes,Patiala,Supervisor One,supervisor.one@thapar.edu,,,,,Committee One,committee.one@thapar.edu,,,,,cognate.one@thapar.edu,,,Expert One,expert.one@elsewhere.edu,Professor,Physics,Elsewhere Institute',
                    ])],
                    'path' => '/students/bulk-upload',
                    // Off by default: an import of the institute's sheet is a
                    // migration of records, and a link lives 24 hours.
                    'extra' => [[
                        'key' => 'send_invites',
                        'label' => 'Email each new scholar their sign-in link now. The link lasts 24 hours, so leave this off until they have been told the portal exists.',
                    ]],
                    'batch' => [
                        'size' => 50,
                        'run_id' => true,
                        'loader' => false,
                        'reports_failures' => true,
                        'summary' => '{created} created, {updated} updated, {errors} errors',
                        'done' => 'Import completed: {summary}',
                        'none' => 'Nothing was imported: {summary}',
                        'failed' => 'Batch {n} failed',
                        'crashed' => 'Failed to import CSV',
                    ],
                ]] : []),
                ...($managesUrf ? ['ug-import' => [
                    'kind' => 'rows',
                    'title' => 'Bulk import UG students',
                    'required' => ['full_name', 'email', 'roll_no', 'branch_code', 'year'],
                    'rules' => [
                        'Matched on email, so importing a corrected file updates rather than duplicates.',
                        'branch_code is the code from Configuration, and programme narrows it when two degrees share one.',
                        'year is the year of study, 1 to 4.',
                        'A new student is emailed a link to set their password.',
                    ],
                    'sample' => ['name' => 'ug_students_sample.csv', 'csv' => implode("\n", [
                        'full_name,email,roll_no,programme,branch_code,year,phone,gender',
                        'Nikhil Verma,nverma_be23@thapar.edu,102303001,BE,COE,2,9876500000,Male',
                        'Aarti Singh,asingh_btech22@thapar.edu,102203002,BTech,CSE,3,9876500001,Female',
                    ])],
                    'path' => '/ug-students/import',
                    'failed' => 'Could not import the students.',
                ]] : []),
            ] ?: (object) [],
        ]);
    }

    /** A UG student's account; a new one is made without a password and sent the link to choose one. */
    private static function ugRows(bool $edit): array
    {
        $text = fn (string $label, string $key) => Field::text($label)->key($key)->value('')->from($key)->open();
        $branches = UgBranch::ordered()->get(['id', 'programme', 'name'])
            ->map(fn ($branch) => ['title' => "{$branch->programme} {$branch->name}", 'value' => $branch->id])->all();
        $suffix = fn (int $year) => ['', 'st', 'nd', 'rd'][$year] ?? 'th';

        return [
            self::row([
                $text('First Name', 'first_name')->required(),
                $text('Last Name', 'last_name'),
                $text('Institute Email', 'email')->inputType('email')->required(),
                $text('Roll Number', 'roll_no')->required(),
                Field::select('Branch', $branches)->key('branch_id')->value('')->from('branch_id')->required()->open(),
                $text('Phone Number', 'phone'),
                Field::select('Gender', [['title' => 'Male', 'value' => 'Male'], ['title' => 'Female', 'value' => 'Female']])->key('gender')->value('')->from('gender')->open(),
                Field::select('Year of Study', array_map(fn ($year) => ['title' => $year . $suffix($year) . ' Year', 'value' => $year], [1, 2, 3, 4]))
                    ->key('year')->value('')->from('year_of_study')->required()->open(),
            ]),
            self::buttons($edit ? 'Save changes' : 'Add student'),
        ];
    }
}
