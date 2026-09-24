<?php

namespace App\Forms;

/**
 * The scholar's application to change status (full time, part time). The
 * change asked for is fixed when the form is raised; the scholar gives only
 * the reason. StatusChangeFormController refuses a third change.
 */
final class StatusChangeDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Application for status change';
    }

    protected function panels(array $data): array
    {
        $previous = self::plain($data['previous_changes'] ?? []) ?? [];
        $last = $previous ? $previous[count($previous) - 1] : null;

        return [
            'student' => array_values(array_filter([
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                ]),
                self::row([
                    Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                    Field::text('Department')->value($data['department'] ?? null),
                ]),
                self::row([
                    Field::text('Email')->value($data['email'] ?? null),
                    Field::text('Phone number')->value($data['phone'] ?? null),
                ]),
                self::row([
                    Field::text('Title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Status of student at time of admission')->value($data['initial_status'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Change of status availed (if any earlier)')->value($last ? 'Yes' : 'No'),
                ], space: 2),
                // The date is shown as stored, which is how the page has always
                // shown it.
                $last ? self::row([
                    Field::text('Date of previous extension')->value($last['created_at'] ?? null),
                    Field::text('Date of IRB Meeting')->value(self::plain($data['date_of_irb'] ?? null))->format('date'),
                ]) : null,
                self::row([
                    Field::text('Required status change')->value($data['type_of_change'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Reason for status change')
                        ->key('reason')
                        ->required()
                        ->editableBy('student', anyReader: true)
                        ->rules('required|string')
                        ->value($data['reason'] ?? null),
                ], space: 2),
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
            ])),
        ];
    }
}
