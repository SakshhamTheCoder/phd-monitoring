<?php

namespace App\Forms;

/**
 * The supervisor's national and international examiners for the thesis, the
 * DoRDC's decision on each, and the Director's approval. The chain starts at
 * the supervisor, so the scholar's details head the form as a section of
 * their own.
 *
 * Both answering panels are custom: the supervisor searches, adds through a
 * dialog and removes saved examiners at once; the DoRDC accepts or rejects
 * each row. ListOfExaminersController checks what they send.
 */
final class ListOfExaminersDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'List of examiners';
    }

    protected function lead(array $data): ?array
    {
        return [
            'title' => 'Student',
            'rows' => [
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                ]),
                self::row([
                    Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                ]),
                self::row([
                    Field::text('Email')->value($data['email'] ?? null),
                    Field::text('Mobile number')->value($data['phone'] ?? null),
                ]),
                self::row([
                    Field::table('', ['name' => 'Name', 'department' => 'Department', 'designation' => 'Designation'], self::plain($data['supervisors'] ?? []) ?? []),
                ], space: 2, label: 'Supervisors'),
            ],
        ];
    }

    // The Director may send the list back as well as approve it.
    protected function stepOptions(): array
    {
        return ['director' => ['allow_rejection' => true]];
    }

    protected function panels(array $data): array
    {
        return [
            'faculty' => self::custom('examiner-nominations'),
            'dordc' => self::custom('examiner-decisions'),
        ];
    }
}
