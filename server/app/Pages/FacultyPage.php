<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\User;
use App\Support\Navigation;

/** Faculty: the staff directory, internal and external both. */
final class FacultyPage extends PageDefinition
{
    /** How a batched staff import (faculty, users) reports, in the pages' words. */
    public const STAFF_IMPORT = [
        'size' => 50,
        // False, not omitted: the app-wide overlay would cover the dialog's own progress bar.
        'loader' => false,
        'summary' => '{created} created, {updated} updated, {errors} errors',
        'done' => 'Import completed: {summary}',
        'none' => 'Nothing was imported: {summary}',
        'failed' => 'Batch {n} failed: {message}',
        'crashed' => 'Failed to import CSV',
    ];

    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'facultyDirectory');
    }

    public function view(User $user, array $params = []): array
    {
        // A viewer with only directory access is browsing, not managing.
        $manages = $user->may('can_manage_faculties');

        return self::page('Faculty', "The institute's own staff, and the supervisors who guide its scholars from other institutes.", [
            'actions' => $manages ? [
                self::action('Import from CSV', 'import', 'secondary'),
                self::action('Import external supervisors', 'import-external', 'secondary'),
                self::action('Add faculty', 'add'),
            ] : [],
            'table' => [
                'endpoint' => '/faculty',
                'search' => ['path' => '/faculty'],
                // A row leads to the profile, never to the edit form. Editing
                // lives in the actions menu, where the capability check is.
                'opens' => ['navigate' => '/faculty/{faculty_code}/profile'],
                'actions' => [
                    ...($manages ? [['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'edit']] : []),
                    ['label' => 'View profile', 'icon' => 'fa fa-user-circle', 'navigate' => '/faculty/{faculty_code}/profile'],
                ],
            ],
            'dialogs' => $manages ? [
                'add' => $this->dialog(['close_outside' => false, 'width' => '800px'], self::facultyRows(edit: false), self::createRequest()),
                'edit' => $this->dialog(['close_outside' => false, 'width' => '800px'], self::facultyRows(edit: true), [
                    'method' => 'PUT',
                    'path' => '/faculty/update/{id}',
                    'done' => 'Faculty updated successfully.',
                    'failure' => 'fetch',
                    'loader' => false,
                ]),
            ] : (object) [],
            'imports' => $manages ? [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import faculty from CSV',
                    'required' => ['Emp id', 'Full Name', 'Email', 'Designation', 'Department Code'],
                    'rules' => [
                        'Matched by email. An existing faculty member is updated from the cells the row fills in.',
                        "Broad Area of Expertise must already be on that department's research area list.",
                        "Students Supervising in TIET is compared against the portal's own count, not stored.",
                        'New faculty are added as internal faculty. Somebody from another institute '
                            . 'goes through Import external supervisors instead.',
                    ],
                    'sample' => ['name' => 'faculty_bulk_import_sample.csv', 'csv' => implode("\n", [
                        'Emp id,Full Name,Email,Phone,Designation,Department Code,Broad Area of Expertise,Specific Areas under Broad Area of Expertise (comma separated),Students Supervising in TIET,Students Supervising Outside TIET',
                        '10001,Dr. Tarunpreet Bhatia,tarunpreet.bhatia@demo.invalid,9800000001,Professor,CSED,Artificial Intelligence,"Machine Learning, Cyber Security",3,1',
                        '10002,Khalid Bashir,khalid.bashir@demo.invalid,9800000002,Assistant Professor,ECED,Signal Processing,"Speech Processing",0,0',
                    ])],
                    'path' => '/faculty/bulk-import',
                    'download' => self::fixList(
                        'Staff with no research area',
                        '/faculty/without-an-area',
                        'staff_with_no_research_area.csv'
                    ),
                    'extra' => [[
                        'key' => 'send_invites',
                        'label' => 'Email each new faculty member their sign-in link now. The link lasts 24 hours, so leave this off until they have been told the portal exists.',
                    ]],
                    // One id for the run, so Send sign-in links on Manage Users can
                    // mail exactly the people this import brought in.
                    'batch' => self::STAFF_IMPORT + ['run_id' => true],
                ],
                // Their own button and their own file. A scholar's supervisor or
                // committee member from another institute is read from the
                // faculty table like anybody else, so the seat the scholars
                // sheet names for them is empty until they have a record.
                'import-external' => [
                    'kind' => 'rows',
                    'title' => 'Import external supervisors from CSV',
                    'required' => ['Full Name', 'Email', 'Designation', 'Department Code'],
                    'rules' => [
                        'Matched by email. Somebody already here is updated from the cells the row fills in.',
                        'Every row is external. The employee code is given to them, so the file carries none.',
                        'Only the name, email and Department Code are needed. Institution is worth filling in, since the list names it where somebody guides from.',
                        'Department Code is the department of the scholar they guide, which is what files them on the lists.',
                        'Designation sets how many scholars they may guide: 8 professor, 6 associate, 4 assistant.',
                    ],
                    'sample' => ['name' => 'external_supervisors_sample.csv', 'csv' => implode("\n", [
                        'Full Name,Email,Phone,Designation,Department Code,Institution,Website Link,Areas of Expertise (comma separated)',
                        'Dr. Sanjeev Bedi,sbedi@demo.invalid,,Professor,MED,University of Waterloo,https://uwaterloo.ca,"Machining, CAD"',
                        'Dr. Ingo Hein,i.hein@demo.invalid,,Professor,BTD,University of Dundee,,Plant Genetics',
                    ])],
                    'path' => '/faculty/bulk-import-external',
                    'extra' => [[
                        'key' => 'send_invites',
                        'label' => 'Email each one their sign-in link now. Leave this off: an outside supervisor has no reason to hear from the portal before the office writes to them.',
                    ]],
                    'batch' => self::STAFF_IMPORT + ['run_id' => true],
                ],
            ] : (object) [],
        ]);
    }

    /** Where a new faculty member is sent, and what the answer says. */
    public static function createRequest(): array
    {
        return [
            'method' => 'POST',
            'path' => '/faculty/add',
            // A new faculty account is mailed a link and chooses its own password.
            'done' => 'Faculty added.',
            'done_from_answer' => true,
            'failure' => 'fetch',
            'loader' => false,
        ];
    }

    /**
     * One faculty member's fields, for adding or editing one. An external
     * member's edit also asks their institution and website; the department
     * and faculty code are theirs to leave out.
     */
    public static function facultyRows(bool $edit, bool $cancel = true): array
    {
        $text = fn (string $label, string $key) => Field::text($label)->key($key)->value('')->from($key)->open();
        $internal = [['key' => 'type', 'test' => 'differs', 'than' => 'external']];
        $external = [['key' => 'type', 'test' => 'equals', 'than' => 'external']];

        $submit = Field::submit($edit ? 'Update faculty' : 'Add faculty')
            ->requiresFilled(['full_name'], 'Full Name is required.')
            ->requiresFilled(['email'], 'Email is required.')
            ->requiresFilled(['phone'], 'Phone is required.')
            ->requiresFilled(['designation'], 'Designation is required.')
            ->requiresAll(['department_id'], 'Department is required.', $internal)
            ->requiresFilled(['faculty_code'], 'Faculty Code is required.', $internal);

        return [
            Field::hidden('type')->value('')->from('type')->neverSent()->open(),
            self::heading($edit ? 'Edit faculty' : 'Create faculty'),
            self::row([Field::text('Full Name*')->key('full_name')->value('')->hint('e.g. Dr. Tarunpreet Bhatia')->from('name', ['first_name', 'last_name'])->open()]),
            self::row([$text('Email*', 'email'), $text('Phone*', 'phone')], space: 2, ratio: [2, 1]),
            self::row([
                // A broad area belongs to one department, so a new department
                // drops the old choice rather than saving it against the wrong one.
                Field::suggest('Department*', '/suggestions/department')->key('department_id')->value('')->from('department_id')
                    ->displayFrom('department')->picks(['department_id' => 'id'])->clears(['area_of_specialization_id'])->open(),
                $text('Designation*', 'designation'),
            ]),
            self::row([$text('Faculty Code*', 'faculty_code')]),
            self::row([Field::text('Institution')->key('institution')->value('Thapar Institute of Engineering and Technology')->from('institution')->open()], showIf: $external),
            self::row([Field::text('Website Link')->key('website_link')->value('')->hint('https://example.com')->from('website_link')->open()], showIf: $external),
            self::row([
                Field::select('Broad Area of Expertise', [])->key('area_of_specialization_id')->value('')->from('area_of_specialization_id')
                    ->optionsFrom('/departments/area-of-specialization?department_id={department_id}', 'id', '{name}', dependsOn: 'department_id')->open(),
            ]),
            self::row([
                Field::text('Specific Areas under Broad Area (comma separated)')->key('expertise')->value('')
                    ->hint('e.g., Machine Learning, Data Mining, Cyber Security')->fromJoined('expertise', ', ')->open(),
            ]),
            self::buttons($submit, $cancel ? 'Cancel' : null),
        ];
    }
}
