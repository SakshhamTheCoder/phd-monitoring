<?php

namespace App\Forms;

use App\Http\Controllers\ExternalReviewController;

/**
 * The scholar's revised IRB, and each supervisor's recommendation with their
 * supervision counts. What happens after (the outside expert, the IRB
 * committee, the office) stays in IrbSubController.
 */
final class IrbSubmissionDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'IRB submission';
    }

    // The supervisor's panel was drawn straight into its step.
    protected function unwrapped(): array
    {
        return ['faculty'];
    }

    protected function notices(array $data): array
    {
        if (($data['stage'] ?? null) !== 'external' || !in_array($data['role'] ?? null, ExternalReviewController::RESEND_ROLES, true)) {
            return [];
        }
        return [[
            'tone' => 'info',
            'text' => "This submission is awaiting the outside expert's review.",
            'action' => [
                'label' => 'Resend review request',
                'endpoint' => '/irb-submissions/' . ($data['form_id'] ?? '') . '/resend-external-review',
                'done' => 'Review request resent to the expert.',
                'failed' => 'Could not resend the review request.',
            ],
        ]];
    }

    protected function panels(array $data): array
    {
        $storedPdf = $data['revised_irb_pdf'] ?? null;
        $current = $data['current_supervisor'] ?? null;
        $objectives = self::plain($data['revised_phd_objectives'] ?? null);

        $currentFacts = fn (string $label, string $key) => $current
            ? Field::text($label)->required()->value($current[$key] ?? null)
            : Field::text($label)->required();
        $counter = fn (string $label, string $key) => $current
            ? Field::counter($label)->value($current[$key] ?? null)
            : Field::counter($label);

        return [
            'student' => [
                self::row([
                    Field::text('Roll number')->value($data['roll_no'] ?? null),
                    Field::text('Name')->value($data['name'] ?? null),
                    Field::text('Gender')->value($data['gender'] ?? null),
                ]),
                self::row([
                    Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                    Field::text('Department')->value($data['department'] ?? null),
                    Field::text('CGPA')->value($data['cgpa'] ?? null),
                ]),
                self::row([
                    Field::text('Email')->value($data['email'] ?? null),
                    Field::text('Mobile number')->value($data['phone'] ?? null),
                ]),
                self::row([
                    Field::text('Previous proposed title of PhD thesis')->value($data['phd_title'] ?? null),
                ], space: 2),
                self::row([
                    Field::text('Revised title of PhD thesis')
                        ->key('revised_phd_title')
                        ->required()
                        ->editableBy('student', anyReader: true)
                        ->rules('required|string')
                        ->value($data['revised_phd_title'] ?? null),
                ], space: 2),
                // Once submitted the objectives stay as boxes, read-only.
                Field::list('Revised PhD objectives')
                    ->key('revised_phd_objectives')
                    ->required()
                    ->editableBy('student', anyReader: true)
                    ->rules('required|array')
                    ->value($objectives ?? [''])
                    ->with([
                        'add_label' => 'Add objective',
                        'each' => 3,
                        'as' => 'inputs',
                    ]),
                self::row([
                    // A resubmission keeps the stored PDF unless a new one comes.
                    Field::file('')
                        ->key('irb_pdf')
                        ->required(!$storedPdf)
                        ->hideLabel()
                        ->editableBy('student', anyReader: true)
                        ->rules(($storedPdf ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                        ->value($storedPdf),
                ], label: 'Revised IRB PDF file'),
                self::row([
                    Field::date('Date of IRB submission')
                        ->key('date_of_irb')
                        ->required()
                        ->format('date')
                        ->hint('Select date...')
                        ->editableBy('student', anyReader: true)
                        ->rules('required|string')
                        ->value($data['date_of_irb'] ?? null),
                    Field::date('Date of IRB revision')->value(self::plain($data['created_at'] ?? null))->format('date'),
                ], space: 1),
                self::row([
                    Field::submit('Submit')->editableBy('student'),
                ]),
            ],
            'faculty' => [
                // The supervisors' loads, once this supervisor has answered.
                self::row([
                    Field::table('', [
                        'name' => 'Name',
                        'department' => 'Department',
                        'designation' => 'Designation',
                        'supervised_campus' => 'Supervised campus',
                        'supervised_outside' => 'Supervised outside',
                    ], self::plain($data['supervisors'] ?? []) ?? [])->onlyWhile('locked', 'faculty'),
                ], space: 3, label: 'Supervisors'),
                Field::recommendation('supervisor')
                    ->editableBy('faculty')
                    ->value(self::stepAnswered($data, 'supervisor') ? ($data['approvals']['supervisor'] ?? null) : null),
                self::row([
                    $currentFacts('Name', 'name')->onlyWhile('editing', 'faculty'),
                    $currentFacts('Department', 'department')->onlyWhile('editing', 'faculty'),
                    $currentFacts('Designation', 'designation')->onlyWhile('editing', 'faculty'),
                ]),
                self::row([
                    $counter('Inside TIET students', 'supervised_campus')->onlyWhile('editing', 'faculty'),
                    // Checked by IrbSubController only on a recommendation, so
                    // it carries no rule here.
                    $counter('Outside TIET students', 'supervised_outside')
                        ->key('supervised_outside')
                        ->editableBy('faculty')
                        ->onlyWhile('editing', 'faculty'),
                ], label: 'Total number of students under guidance (including this applicant)'),
                self::row([
                    Field::submit('Submit')
                        ->editableBy('faculty')
                        ->requires('approval', 'Choose Recommend or Not Recommend first.'),
                ]),
            ],
        ];
    }
}
