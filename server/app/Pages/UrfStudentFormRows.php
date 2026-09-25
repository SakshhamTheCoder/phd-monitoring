<?php

namespace App\Pages;

use App\Forms\Field;
use App\Forms\ResolvesRows;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\UgBranch;
use App\Models\User;

/**
 * A UG student's own URF forms (the application, the fellowship details and
 * a report) as rows a client's server form renderer draws and posts, with the
 * request each is sent by. Sent beside UrfStudentFormPage's body, so a client
 * that draws the form itself keeps doing so.
 */
final class UrfStudentFormRows
{
    use ResolvesRows;

    private const GENDERS = [['title' => 'Male', 'value' => 'Male'], ['title' => 'Female', 'value' => 'Female']];

    /** The application, new or being corrected after a send back. */
    public static function apply(User $user, ?array $student, ?array $initial): array
    {
        $account = [
            'name' => trim($user->first_name . ' ' . $user->last_name),
            'email' => $user->email,
            'phone' => $user->phone,
            'gender' => $user->gender,
            'roll_no' => $student['roll_no'] ?? null,
            'branch_id' => $student['branch_id'] ?? null,
        ];
        $start = $initial ?? [
            'student1_name' => $account['name'],
            'student1_email' => $account['email'],
            'student1_phone' => $account['phone'],
            'student1_gender' => $account['gender'],
            'student1_roll_no' => $account['roll_no'],
            'student1_branch_id' => $account['branch_id'],
            'student1_year' => $student['year'] ?? null,
        ];

        $rows = [
            self::row([Field::text('Project Title')->key('project_title')->value($start['project_title'] ?? null)->required()->open()], space: 3),
            ['kind' => 'heading', 'text' => 'Your details', 'level' => 3],
            ...self::studentRows(1, $start, $account),
            // Removing the team member or the second mentor is a switch off;
            // the server then drops what was typed for them.
            self::row([Field::onOff('Add a team member')->key('has_teammate')->value(!empty($start['student2_name']))->open()]),
            ['kind' => 'group', 'rows' => self::studentRows(2, $start, []), 'show_if' => [['key' => 'has_teammate', 'test' => 'set']]],
            ['kind' => 'heading', 'text' => 'Faculty mentors', 'level' => 3],
            self::row([self::mentor('Faculty mentor', 1, $initial)->required()]),
            self::row([Field::onOff('Add a second faculty mentor')->key('has_mentor2')->value(!empty($start['mentor2_faculty_code']))->open()]),
            self::row([self::mentor('Second faculty mentor', 2, $initial)->showIf('has_mentor2')]),
            self::row([Field::file($initial ? 'Replace Project Proposal (PDF)' : 'Project Proposal (PDF)')->key('proposal')->maxMb(20)->required(!$initial)->open()]),
            self::row([Field::submit($initial ? 'Update application' : 'Submit application')->heldWhileSending()->open()]),
        ];

        return [
            'rows' => (new self())->resolveRows($rows, []),
            'request' => ['method' => 'POST', 'path' => '/urf', 'done' => $initial ? 'Application updated' : 'Application submitted', 'failure' => 'fetch'],
            // A new application goes back to the forms; a correction reads the form again.
            'after' => $initial ? 'reload' : 'forms',
        ];
    }

    /** What a selected student gives for the stipend. */
    public static function fellow(int $applicationId, ?array $initial, ?array $prefill): array
    {
        $start = $initial ?? $prefill ?? [];
        $text = fn (string $label, string $key) => Field::text($label)->key($key)->value($start[$key] ?? null)->required()->open();

        $rows = [
            self::row([
                $text('Full Name (as per PAN Card)', 'full_name'),
                Field::date('Date of Birth')->key('dob')->value(isset($start['dob']) ? substr((string) $start['dob'], 0, 10) : null)->required()->open(),
                Field::select('Gender', self::GENDERS)->key('gender')->value($start['gender'] ?? null)->required()->open(),
                $text("Father's Name", 'father_name'),
                $text('PAN Card Number', 'pan'),
                $text('Aadhaar Card Number', 'aadhaar'),
                $text('Bank Name', 'bank_name'),
                $text('Bank Account Number', 'account_no'),
                $text('IFSC Code', 'ifsc'),
            ]),
            self::row([Field::submit($initial ? 'Update details' : 'Submit details')->heldWhileSending()->open()]),
        ];

        return [
            'rows' => (new self())->resolveRows($rows, []),
            'request' => ['method' => 'POST', 'path' => "/urf/{$applicationId}/fellow", 'done' => 'Fellowship details saved', 'failure' => 'fetch'],
            'after' => 'reload',
        ];
    }

    /**
     * The half-yearly or final report. Who is filing and for which project
     * come from the application; publications are picked from the student's
     * own library.
     */
    public static function report(User $user, array $application, string $type, ?array $filed): array
    {
        $slot = strtolower((string) ($application['student2_email'] ?? '')) === strtolower((string) $user->email) ? 2 : 1;
        $mentors = array_values(array_filter([$application['mentor1'] ?? null, $application['mentor2'] ?? null]));
        $mentorName = fn ($mentor) => trim(($mentor['user']['first_name'] ?? '') . ' ' . ($mentor['user']['last_name'] ?? ''));
        $locked = fn (string $label, mixed $value) => Field::text($label)->value($value);

        [$column, $owner] = Publication::ownerOf($user);
        $library = Publication::groupedFor($column, $owner ?? 0);
        $linked = $filed['publications'] ?? [];
        $picked = fn (array $groups) => array_values(array_map(fn ($row) => $row['id'], array_merge(...array_values($groups) ?: [[]])));
        $options = fn ($rows) => array_values(array_map(fn ($row) => [
            'value' => $row['id'],
            'title' => trim(($row['title'] ?? '') . (isset($row['year']) ? " ({$row['year']})" : '')),
        ], is_array($rows) ? $rows : $rows->toArray()));

        $papers = [];
        foreach (['sci', 'non_sci', 'international', 'national', 'book'] as $group) {
            $papers = array_merge($papers, $options($library[$group]));
        }
        $patents = $options($library['patents']);

        $rows = [
            self::row([$locked('Title of Project', $application['project_title'] ?? null)], space: 3),
            self::row([
                $locked('Name', $application["student{$slot}_name"] ?? null),
                $locked('Roll No.', $application["student{$slot}_roll_no"] ?? null),
                $locked('Branch', $application["student{$slot}_branch"]['name'] ?? null),
                $locked('Email', $application["student{$slot}_email"] ?? null),
                $locked('Contact No.', $application["student{$slot}_phone"] ?? null),
                $locked('Faculty Mentor Name', implode(', ', array_map($mentorName, $mentors))),
                $locked('Faculty Mentor Department', implode(', ', array_filter(array_map(fn ($m) => $m['department']['name'] ?? null, $mentors)))),
            ]),
            Field::hidden('type')->value($type)->open(),
            ['kind' => 'heading', 'text' => 'Publication details', 'level' => 3],
            $papers
                ? self::row([Field::checks('Publications on this report', $papers)->key('publications')
                    ->value($picked(array_diff_key($linked, ['patents' => true])))->open()])
                : ['kind' => 'paragraph', 'text' => 'Your library has no publications yet. Add them on your Publications page, then pick them here.'],
            ...($patents ? [self::row([Field::checks('Patents on this report', $patents)->key('patents')->value($picked(['patents' => $linked['patents'] ?? []]))->open()])] : []),
            self::row([
                Field::text('Conference Presentation (if any)')->key('conference_presentation')->value($filed['conference_presentation'] ?? null)->open(),
                Field::file('Upload the Report (PDF)')->key('report')->maxMb(20)->required()->open(),
            ]),
            self::row([Field::submit('Submit ' . UrfStudentFormsPage::REPORT_TYPES[$type])->heldWhileSending()->open()]),
        ];

        return [
            'rows' => (new self())->resolveRows($rows, []),
            'request' => [
                'method' => 'POST',
                'path' => "/urf/{$application['id']}/reports",
                'done' => UrfStudentFormsPage::REPORT_TYPES[$type] . ' submitted',
                'failure' => 'fetch',
            ],
            'after' => 'reload',
        ];
    }

    private static function studentRows(int $n, array $start, array $account): array
    {
        $key = fn (string $field) => "student{$n}_{$field}";
        // What the account already knows is locked, and sent anyway.
        $known = fn (Field $field, string $part) => !empty($account[$part]) ? $field->lockedIf(true)->alwaysSent() : $field;
        $years = array_map(fn ($year) => ['title' => $year . (['', 'st', 'nd', 'rd'][$year] ?? 'th') . ' Year', 'value' => $year], [1, 2, 3, 4]);
        $branches = UgBranch::ordered()->get(['id', 'programme', 'name'])
            ->map(fn ($branch) => ['title' => "{$branch->programme} {$branch->name}", 'value' => $branch->id])->all();

        return [self::row([
            $known(Field::text('Name')->key($key('name'))->value($start[$key('name')] ?? null)->required()->open(), 'name'),
            $known(Field::text('Roll Number')->key($key('roll_no'))->value($start[$key('roll_no')] ?? null)->required()->open(), 'roll_no'),
            $known(Field::select('Branch', $branches)->key($key('branch_id'))->value($start[$key('branch_id')] ?? null)->required()->open(), 'branch_id'),
            // Not locked: the year moves with the student, and a fellow applying
            // again next year corrects it here.
            Field::select('Year', $years)->key($key('year'))->value($start[$key('year')] ?? null)->required()->open(),
            $known(Field::select('Gender', self::GENDERS)->key($key('gender'))->value($start[$key('gender')] ?? null)->required()->open(), 'gender'),
            $known(Field::text('Official Email')->key($key('email'))->value($start[$key('email')] ?? null)->inputType('email')->required()->open(), 'email'),
            $known(Field::text('Phone Number')->key($key('phone'))->value($start[$key('phone')] ?? null)->required()->open(), 'phone'),
        ])];
    }

    private static function mentor(string $label, int $n, ?array $initial): Field
    {
        $mentor = $initial["mentor{$n}"] ?? null;
        $name = $mentor ? trim(($mentor['user']['first_name'] ?? '') . ' ' . ($mentor['user']['last_name'] ?? '')) : null;

        return Field::suggest($label, '/suggestions/faculty')
            ->key("mentor{$n}_faculty_code")
            ->params(['type' => 'internal'])
            ->shows(['name', 'designation', 'department'])
            ->value($initial["mentor{$n}_faculty_code"] ?? null)
            ->display($name)
            ->open();
    }
}
