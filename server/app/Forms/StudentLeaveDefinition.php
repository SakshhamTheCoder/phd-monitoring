<?php

namespace App\Forms;

/**
 * A scholar's leave application and the HOD's decision on it. It is not a
 * chain walked step by step but two sections, and it is opened on its own
 * page and inside the attendance pages alike.
 *
 * The scholar's answers are checked by StudentLeaveFormController (a half day
 * only on a single date, a document for academic leave and none for casual),
 * as before.
 */
final class StudentLeaveDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Leave application';
    }

    protected function panels(array $data): array
    {
        return [];
    }

    protected function sections(array $data): array
    {
        $editable = self::mayEdit($data, 'student');
        $isScholar = ($data['role'] ?? null) === 'student';

        return [
            [
                'title' => 'Student',
                'rows' => [
                    Field::leave([
                        'editable' => $editable,
                        'types' => [['value' => 'casual', 'title' => 'Casual'], ['value' => 'academic', 'title' => 'Academic']],
                        'default_type' => 'casual',
                        // The types a document goes with; the others take none.
                        'document_types' => ['academic'],
                        'day_parts' => [
                            ['value' => 'full', 'label' => 'Full day'],
                            ['value' => 'first_half', 'label' => 'First half'],
                            ['value' => 'second_half', 'label' => 'Second half'],
                        ],
                        'reason_max' => 1000,
                        'reason_hint' => 'Why you need this leave (max 1000 characters)',
                        'half_day_hint' => 'A half day applies to a single date only.',
                        // Only the scholar may read their own balance.
                        'balance_path' => $isScholar ? '/forms/student-leave/balance' : null,
                        'form_path' => '/forms/student-leave/' . ($data['form_id'] ?? ''),
                        'deletable' => $editable && ($data['status'] ?? null) === 'draft',
                        'answers' => [
                            'leave_type' => $data['leave_type'] ?? null,
                            'from_date' => self::plain($data['from_date'] ?? null),
                            'to_date' => self::plain($data['to_date'] ?? null),
                            'day_part' => $data['day_part'] ?? null,
                            'reason' => $data['reason'] ?? null,
                            'supporting_document' => $data['supporting_document'] ?? null,
                        ],
                        'messages' => [
                            'dates' => 'Select the from and to dates',
                            'reason' => 'A reason is required',
                            'document' => 'Attach a supporting PDF for an academic leave',
                            'submitted' => 'Leave application submitted',
                            'completed' => 'Form completed successfully',
                            'over' => '{days} day(s) over your {type} quota. This can still be submitted.',
                            'delete' => 'Delete this draft application?',
                        ],
                    ]),
                ],
            ],
            [
                'title' => 'HOD',
                // The scholar has no decision to make on their own application,
                // so they get the outcome; everyone else the HOD's decision,
                // live for the HOD and locked for anyone reading along.
                'rows' => $isScholar
                    ? [
                        Field::facts([
                            ['label' => 'Status', 'value' => $data['status'] ?? null, 'badge' => true],
                            ['label' => 'HOD remarks', 'value' => ($data['comments']['hod'] ?? null) ?: 'None'],
                        ], 'leave-outcome'),
                    ]
                    : [
                        Field::recommendation('hod', allowRejection: true)
                            ->with(['more_fields' => false, 'decision' => true, 'title' => 'Decision:']),
                    ],
            ],
        ];
    }
}
