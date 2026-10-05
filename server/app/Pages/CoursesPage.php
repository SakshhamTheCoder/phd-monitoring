<?php

namespace App\Pages;

use App\Forms\Field;
use App\Models\Department;
use App\Models\User;
use App\Support\Navigation;

/** Course Management: courses, tagging scholars to them, and coursework imports. */
final class CoursesPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return Navigation::allows($user, 'courseManagement');
    }

    public function view(User $user, array $params = []): array
    {
        $role = $user->current_role?->role;
        // Tagging and the coursework import need can_manage_students, except for
        // a head or coordinator, whom the server holds to their own department's
        // scholars and courses.
        $tags = $user->may('can_manage_students') || in_array($role, ['hod', 'phd_coordinator'], true);
        // Heads and coordinators manage their own department's courses; the
        // server fills the department in for them, so only admin picks one.
        $picksDepartment = $role === 'admin';

        return self::page('Course management', 'Add courses, tag scholars to them and import coursework.', [
            'actions' => [
                ...($tags ? [
                    self::action('Tag student', 'tag', 'secondary'),
                    self::action('Import coursework', 'import', 'secondary'),
                    self::action('Import course details', 'courses', 'secondary'),
                ] : []),
                self::action('Add course', 'add'),
            ],
            'table' => [
                'endpoint' => '/courses/list',
                'search' => ['path' => '/courses'],
                // A course has no page of its own; editing is in the row menu.
                'actions' => [
                    ['label' => 'Edit', 'icon' => 'fa fa-pencil-square-o', 'opens' => 'edit'],
                    ['label' => 'Delete', 'icon' => 'fa fa-trash', 'request' => [
                        'method' => 'DELETE',
                        'path' => '/courses/delete/{id}',
                        'confirm' => 'Are you sure you want to delete this course?',
                        'done' => 'Course deleted.',
                        'failed' => 'Failed to delete course.',
                    ]],
                ],
            ],
            'dialogs' => [
                'add' => $this->dialog(
                    ['title' => 'Add new course', 'close_outside' => false],
                    [self::group([...$this->courseFields($picksDepartment, hints: true), self::buttons($this->send('Add course'))], className: 'field-stack')],
                    ['method' => 'POST', 'path' => '/courses/add', 'done' => 'Course added.', 'failed' => 'Failed to add course.'],
                ),
                'edit' => $this->dialog(
                    ['title' => 'Edit course', 'close_outside' => false],
                    [self::group([...$this->courseFields($picksDepartment, hints: false), self::buttons($this->send('Update course'))], className: 'field-stack')],
                    ['method' => 'PUT', 'path' => '/courses/update/{id}', 'done' => 'Course updated.', 'failed' => 'Failed to update course.'],
                ),
                ...($tags ? ['tag' => $this->dialog(
                    ['title' => 'Tag student with course', 'close_outside' => false],
                    [self::group([...$this->tagFields(), self::buttons('Tag student')], className: 'field-stack')],
                    ['method' => 'POST', 'path' => '/courses/student/tag', 'done' => 'Student tagged with course.', 'failed' => 'Failed to tag student.'],
                )] : []),
            ],
            'imports' => $tags ? [
                'import' => [
                    'kind' => 'rows',
                    'title' => 'Import coursework from CSV',
                    'required' => ['Registration Number', 'Academic Year', 'Subject Code'],
                    'rules' => [
                        'A subject code the portal does not have yet is created from the row.',
                        'A grade means the course is finished. Leave it blank while it is still being taken.',
                        'Academic Year is the semester code, for example 2425ODD.',
                        'Importing the same file again updates the enrolments rather than duplicating them.',
                    ],
                    'sample' => ['name' => 'coursework_sample.csv', 'csv' => implode("\n", [
                        'Registration Number,Full Name,Email,Academic Year,Subject Code,Subject,Credits,Grade',
                        '900011,Scholar One,scholar.one@thapar.edu,2425ODD,PCS101,Research Methodology,4,A',
                        '900011,Scholar One,scholar.one@thapar.edu,2425EVEN,PCS102,Advanced Algorithms,3,',
                    ])],
                    'path' => '/courses/student/bulk-import',
                    'download' => self::fixList(
                        'Subjects tagged with no credits',
                        '/courses/student/without-credits',
                        'subjects_tagged_with_no_credits.csv'
                    ),
                    'failed' => 'Failed to import',
                    'batch' => [
                        'size' => 50,
                        'loader' => false,
                        'reports_failures' => true,
                        'summary' => '{created} enrolments imported, {errors} errors',
                        'done' => 'Import completed: {summary}',
                        'none' => 'Nothing was imported: {summary}',
                        'failed' => 'Batch {n} failed',
                        'crashed' => 'Failed to import CSV',
                    ],
                ],
                'courses' => [
                    'kind' => 'rows',
                    'title' => 'Import course details',
                    'required' => ['Course Code'],
                    'rules' => [
                        'One row per subject, not per scholar.',
                        'Matched on the course code, so sending a corrected file again fixes the subject rather than adding a second one.',
                        'A blank cell leaves what is stored alone, so a file may carry only the column being fixed.',
                        'Department Code is the code from the Departments page, for example CSED.',
                    ],
                    'sample' => ['name' => 'courses_sample.csv', 'csv' => implode("
", [
                        'Course Code,Course Name,Credits,Department Code',
                        'PCS101,Research Methodology,4,CSED',
                        'DMC017,Topics of Differential Equations,3,DOM',
                    ])],
                    'path' => '/courses/import',
                    'download' => self::fixList(
                        'Subjects with no credits or department',
                        '/courses/missing-details',
                        'subjects_missing_details.csv'
                    ),
                    'failed' => 'Failed to import',
                    // The catalogue is one long file. Sent whole it is a single
                    // request to time out, with nothing said about the rows that
                    // did land; in batches the office watches it go and reads
                    // one summary at the end.
                    'batch' => [
                        'size' => 50,
                        'loader' => false,
                        'reports_failures' => true,
                        'summary' => '{created} subjects added, {updated} updated, {errors} errors',
                        'done' => 'Import completed: {summary}',
                        'none' => 'Nothing was imported: {summary}',
                        'failed' => 'Batch {n} failed',
                        'crashed' => 'Failed to import CSV',
                    ],
                ],
            ] : (object) [],
        ]);
    }

    /** The send button, which refuses a course without its code, name or a numeric credit count. */
    private function send(string $label): Field
    {
        return Field::submit($label)
            ->requiresFilled(['course_code', 'course_name', 'credits'], 'Course code, name and credits are required')
            ->requiresNumber('credits', 'Credits must be a number');
    }

    /** A course's fields; the add dialog shows an example in each. */
    private function courseFields(bool $picksDepartment, bool $hints): array
    {
        $text = function (string $label, string $key, string $hint) use ($hints) {
            $field = Field::text($label)->key($key)->value('')->from($key)->required()->open();
            return $hints ? $field->hint($hint) : $field;
        };

        return [
            $text('Course Code', 'course_code', 'e.g., CS101'),
            $text('Course Name', 'course_name', 'e.g., Introduction to Computer Science'),
            $text('Credits', 'credits', 'e.g., 3')->inputType('number'),
            // Counted towards the eight masters level courses a B.E. or B.Tech
            // entrant owes. Left unset until somebody says which it is.
            Field::select('Level', [['value' => 'masters', 'title' => 'Masters'], ['value' => 'doctoral', 'title' => 'Doctoral']])
                ->key('level')->value('')->from('level')->open(),
            // Posted either way, as the page always sent it; only admin picks it.
            $picksDepartment
                ? Field::select('Department', Department::orderBy('name')->get()->map(fn ($department) => ['title' => $department->name, 'value' => $department->id])->all())
                    ->key('department_id')->value('')->from('department_id')->required()->open()
                : Field::hidden('department_id')->value('')->from('department_id')->open(),
        ];
    }

    /** Tagging one scholar with one course, for a semester. */
    private function tagFields(): array
    {
        return [
            Field::hidden('student_id')->value('')->open(),
            Field::suggest('Student', '/suggestions/student')->key('student_name')->value('')
                ->shows(['name', 'roll_no'])->hint('Type a name or registration number')
                ->picks(['student_id' => 'roll_no', 'student_name' => 'name'])->required()->open(),
            // Read when the dialog opens, so a course added since is offered too.
            Field::select('Course', [])->key('course_id')->value('')
                ->optionsFrom('/courses/all', 'id', '{course_code} - {course_name}')->required()->open(),
            Field::text('Semester')->key('semester')->value('')->hint('e.g., Fall 2024')->required()->open(),
            Field::select('Status', [['value' => 'enrolled', 'title' => 'Enrolled'], ['value' => 'completed', 'title' => 'Completed']])
                ->key('status')->value('enrolled')->required()->open(),
            Field::text('Grade')->key('grade')->value('')->hint('e.g., A+')->showIf('status', 'equals', 'completed')->open(),
        ];
    }
}
