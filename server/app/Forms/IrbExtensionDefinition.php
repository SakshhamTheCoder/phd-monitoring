<?php

namespace App\Forms;

/** The scholar's request for more time to submit the research proposal. */
final class IrbExtensionDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Extension for submission of research proposal';
    }

    protected function panels(array $data): array
    {
        $supervisors = self::plain($data['supervisors'] ?? []) ?? [];
        $earlier = (self::plain($data['researchExtentions'] ?? []) ?? [])[0]['period_of_extension'] ?? null;
        $storedPdf = $data['research_pdf'] ?? null;

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
                    Field::text('Tentative title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Status of student at time of admission')->value($data['initial_status'] ?? null),
                ], space: 2),
                self::row(self::supervisorFields($supervisors)),
                self::row([
                    Field::text('Extension availed if any earlier (for submission of research proposal)')->value($earlier ?: 'N/A'),
                ], space: 2),
                self::row([
                    Field::text('Reason for extension')
                        ->key('reason')
                        ->required()
                        ->editableBy('student', anyReader: true)
                        ->rules('required|string')
                        ->value($data['reason'] ?? null),
                ], space: 2),
                self::row([
                    // A resubmission after a send-back keeps the stored PDF
                    // unless a new one comes.
                    Field::file('Upload research proposal')
                        ->key('research_pdf')
                        ->required(!$storedPdf)
                        ->editableBy('student', anyReader: true)
                        ->rules(($storedPdf ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                        ->value($storedPdf),
                ]),
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
            ],
        ];
    }
}
