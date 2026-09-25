<?php

namespace App\Forms;

use App\Support\ReportPeriods;

/** The scholar's application to take a semester off. */
final class SemesterOffDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Application for semester off';
    }

    protected function panels(array $data): array
    {
        $previous = self::plain($data['previous_off'] ?? []) ?? [];
        // The last semester taken off. Every record carries its code, so this
        // is set exactly when an earlier one exists.
        $earlierOff = $previous ? ($previous[count($previous) - 1]['semester_off_required'] ?? null) : null;
        $storedApproval = $data['previous_approval_pdf'] ?? null;

        return [
            'student' => [
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
                    Field::text('Semester off (if any earlier)')->value($earlierOff ?: 'N/A'),
                    // The earlier approval is read alongside a repeat request. A
                    // resubmission keeps the stored PDF unless a new one comes.
                    $earlierOff
                        ? Field::file('Attach previous approval')
                            ->key('previous_approval_pdf')
                            ->required(!$storedApproval)
                            ->editableBy('student')
                            ->rules(($storedApproval ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                            ->value($storedApproval)
                        : Field::blank(),
                ]),
                self::row([
                    Field::select('Semester off required', ReportPeriods::around(0, 1))
                        ->key('semester_off_required')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|string')
                        ->value($data['semester_off_required'] ?? null),
                    // Optional, as its label and the server say.
                    Field::file('Attach proof (if any)')
                        ->key('proof_pdf')
                        ->editableBy('student')
                        ->rules('file|mimes:pdf|max:20480')
                        ->value($data['proof_pdf'] ?? null),
                ]),
                self::row([
                    Field::text('Reason for semester off')
                        ->key('reason')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|string')
                        ->value($data['reason'] ?? null),
                ], space: 2),
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
            ],
        ];
    }
}
