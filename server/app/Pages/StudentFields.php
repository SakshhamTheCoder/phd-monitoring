<?php

namespace App\Pages;

use App\Forms\Field;

/**
 * A PhD scholar's record as a dialog's fields: adding one from Students or
 * Manage Users, editing one from Students.
 */
final class StudentFields
{
    use \App\Forms\ResolvesRows;

    /**
     * One scholar's record, for adding or editing one. The roll number is the
     * record's key, so it is fixed once the scholar exists.
     */
    public static function rows(bool $edit, bool $cancel = true): array
    {
        $text = fn (string $label, string $key) => Field::text($label)->key($key)->value('')->from($key)->open();
        $date = fn (string $label, string $key) => Field::date($label)->key($key)->value('')->fromAs($key, 'date')->open();
        $options = fn (array $pairs) => array_map(fn ($value, $title) => ['value' => $value, 'title' => $title], array_keys($pairs), array_values($pairs));

        $submit = Field::submit($edit ? 'Update student' : 'Add student')->requiresNamed([
            'full_name' => 'Full Name',
            'email' => 'Email',
            'phone' => 'Phone',
            'roll_no' => 'Roll Number',
            'gender' => 'Gender',
        ], 'Please fill required fields: ');

        return [
            self::heading($edit ? 'Edit student' : 'Create student'),
            self::row([Field::text('Full Name*')->key('full_name')->value('')->from('full_name')->fromWords(['first_name', 'last_name'])->open()]),
            self::row([$text('Email*', 'email'), $text('Phone*', 'phone')], space: 2, ratio: [2, 1]),
            self::row([
                Field::text('Roll Number*')->key('roll_no')->value('')->from('roll_no')->lockedIf($edit)->alwaysSent()->open(),
                Field::suggest('Department*', '/suggestions/department')->key('department_id')->value('')->from('department_id')
                    ->displayFrom('department')->picks(['department_id' => 'id'])->open(),
            ]),
            self::row([
                $date('Date of Registration*', 'date_of_registration'),
                $date('Date of IRB', 'date_of_irb'),
                // A legacy value that is neither shows as unpicked, so it is picked again.
                Field::select('Gender', $options(['Male' => 'Male', 'Female' => 'Female']))->key('gender')->value('')
                    ->fromAs('gender', 'one_of', ['Male', 'Female'])->required()->open(),
            ]),
            self::row([
                $date('Date of Synopsis', 'date_of_synopsis'),
                $date('Date of Thesis', 'date_of_thesis'),
                $date('Date of Thesis Awarded', 'date_of_thesis_awarded'),
            ], space: 3),
            self::row([
                Field::onOff('Physically handicapped')->key('physically_handicapped')->value(false)->fromAs('physically_handicapped', 'flag')->open(),
                // Yes, No, or not stated: a scholar nobody has asked is not a No.
                Field::select('JRF', $options(['1' => 'Yes', '0' => 'No']))->key('is_jrf')->value('')->fromAs('is_jrf', 'yes_no')->sentAsYesNo()->open(),
                // Which exam, not yes or no. An imported value the list does not
                // name (DBT-BET, GPAT) still shows and is kept.
                Field::select('NET/GATE', $options(['NET' => 'NET', 'GATE' => 'GATE', 'NA' => 'NA']))->key('net_gate')->value('')->from('net_gate')->open(),
            ], space: 3),
            self::row([$text('PhD Title', 'phd_title'), $text("Father's Name", 'fathers_name'), $text('Address', 'address')], space: 3),
            self::row([
                Field::select('Current Status*', $options(['full-time' => 'Full Time', 'part-time' => 'Part Time', 'executive' => 'Executive']))
                    ->key('current_status')->value('')->from('current_status')->open(),
                Field::text('Overall Progress (%)')->key('overall_progress')->value(0)->from('overall_progress')->inputType('number')->open(),
                Field::text('CGPA*')->key('cgpa')->value('')->from('cgpa')->inputType('number')->open(),
            ]),
            self::buttons($submit, $cancel ? 'Cancel' : null),
        ];
    }

    /** Where a new or edited scholar is sent, and what the answer says. */
    public static function request(bool $edit): array
    {
        return array_filter([
            'method' => 'POST',
            'path' => $edit ? '/students/{roll_no}/update' : '/students/add',
            // A new account is mailed a link to set its own password.
            'done' => $edit ? 'Student updated successfully.' : 'Student added.',
            'done_from_answer' => !$edit ?: null,
            'failure' => 'fetch',
            'loader' => false,
        ], fn ($value) => $value !== null);
    }
}
