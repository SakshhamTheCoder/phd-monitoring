<?php

namespace App\Forms;

/**
 * The scholar's request for more time to submit the thesis.
 *
 * The period is not asked: ThesisExtentionController::recordExtention fixes it
 * at twelve months because the regulations do not let the scholar choose one,
 * so it is shown as a fact rather than a field.
 */
final class ThesisExtensionDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Extension for submission of thesis';
    }

    protected function panels(array $data): array
    {
        $supervisors = self::plain($data['supervisors'] ?? []) ?? [];
        $previous = self::plain($data['previous_extensions'] ?? []) ?? [];
        $last = $previous ? $previous[count($previous) - 1] : null;
        $isRepeat = count($previous) > 0;
        // Asked only while the scholar has no synopsis date on record; it is
        // saved on the scholar, not the form.
        $needsSynopsisDate = empty($data['date_of_synopsis']);
        $storedPdf = $data['previous_extention_pdf'] ?? null;

        return [
            'student' => array_values(array_filter([
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                    Field::text('Department')->value($data['department'] ?? null),
                ]),
                self::row([
                    Field::text('Title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 3),
                self::row(self::supervisorFields($supervisors)),
                self::row([
                    Field::text('Status of student at time of admission')->value($data['initial_status'] ?? null),
                    Field::text('Date of IRB Meeting')->value($data['date_of_irb'] ?? null)->format('date'),
                    Field::date('Date of synopsis presentation')
                        ->key('date_of_synopsis')
                        ->required($needsSynopsisDate)
                        ->editableBy('student')
                        ->lockedIf(!$needsSynopsisDate)
                        ->sentOnlyIfChanged()
                        ->rules($needsSynopsisDate ? 'required|date' : '')
                        ->value($data['date_of_synopsis'] ?? null),
                ]),
                self::row([
                    Field::text('Extension availed earlier')->value($isRepeat ? 'Yes' : 'No'),
                    Field::text('Period of extension requested')->value('12 months')->hint('Fixed by regulation'),
                ], space: 2),
                $isRepeat ? self::row([
                    Field::text('Date of previous extension')->value($last['created_at'] ?? null)->format('date'),
                    Field::text('Period of previous extension')
                        ->value(!empty($last['period_of_extention']) ? $last['period_of_extention'] . ' months' : 'N/A'),
                ]) : null,
                self::row([
                    Field::text('Reason for extension')
                        ->key('reason')
                        ->required()
                        ->hint('Why the thesis could not be submitted within the deadline')
                        ->editableBy('student')
                        ->rules('string')
                        ->value($data['reason'] ?? null),
                ], space: 3),
                // The previous grant is read alongside a repeat request. A
                // resubmission keeps the stored PDF unless a new one comes.
                $isRepeat ? self::row([
                    Field::file('Previous extension approval')
                        ->key('previous_extention_pdf')
                        ->required(!$storedPdf)
                        ->maxMb(20)
                        ->editableBy('student')
                        ->rules(($storedPdf ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                        ->value($storedPdf),
                ]) : null,
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
            ])),
        ];
    }
}
