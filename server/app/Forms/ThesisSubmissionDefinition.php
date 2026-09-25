<?php

namespace App\Forms;

/**
 * The scholar's thesis: the synopsis date, the fee paid, the publications
 * linked to it, and the thesis and fee receipt themselves. Every later step is
 * a plain recommendation. ThesisSubmissionController also refuses a thesis
 * outside the submission window.
 */
final class ThesisSubmissionDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Thesis submission';
    }

    protected function panels(array $data): array
    {
        $storedThesis = $data['thesis_pdf'] ?? null;
        $storedReceipt = $data['fee_receipt'] ?? null;
        $statusChanged = self::plain($data['previous_extension_date'] ?? null);

        return [
            'student' => [
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                    Field::text('Date of revised IRB')->value($data['date_of_irb'] ?? null)->format('date'),
                ]),
                self::row([
                    Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                    Field::text('Department')->value($data['department'] ?? null),
                    Field::text('Gender')->value($data['gender'] ?? null),
                ]),
                self::row([
                    Field::text('Address of correspondence')->value($data['address'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Status of student at time of admission')->value($data['initial_status'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Current status')->value(($data['current_status'] ?? null) === 'part-time' ? 'Part Time' : 'Full Time'),
                    // "NA" until the scholar's status has changed.
                    $statusChanged !== 'NA'
                        ? Field::text('Date of change of status')->value($statusChanged)->format('date')
                        : Field::text('Date of change of status')->value($statusChanged),
                ]),
                self::row([
                    Field::date('Date of synopsis presentation')
                        ->key('date_of_synopsis')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|date')
                        ->value(self::plain($data['date_of_synopsis'] ?? null)),
                    Field::text('Receipt number')
                        ->key('reciept_no')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|string')
                        ->value($data['reciept_no'] ?? null),
                    Field::date('Date of fee submission')
                        ->key('date_of_fee_submission')
                        ->required()
                        ->editableBy('student')
                        ->rules('required|date')
                        ->value(self::plain($data['date_of_fee_submission'] ?? null)),
                ]),
                Field::publications(
                    'Publications',
                    ['sci', 'non_sci', 'patents', 'book', 'national', 'international'],
                    'student_publications',
                    self::mayEdit($data, 'student')
                )->with(['add_label' => 'Add publications']),
                // A resubmission keeps the stored files unless new ones come.
                self::row([
                    Field::file('Upload thesis PDF')
                        ->key('thesis_pdf')
                        ->required(!$storedThesis)
                        ->editableBy('student')
                        ->rules(($storedThesis ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                        ->value($storedThesis),
                    Field::file('Upload fee receipt')
                        ->key('fee_receipt')
                        ->required(!$storedReceipt)
                        ->editableBy('student')
                        ->rules(($storedReceipt ? 'nullable' : 'required') . '|file|mimes:pdf,jpg,jpeg,png|max:20480')
                        ->value($storedReceipt),
                ]),
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
            ],
        ];
    }
}
