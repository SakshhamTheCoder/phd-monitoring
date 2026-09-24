<?php

namespace App\Forms;

/**
 * The synopsis: the scholar's written submission and its publications, the
 * supervisor's progress score and publication category, and after the viva a
 * second round opened by the PhD coordinator with the viva's minutes.
 *
 * The supervisor's and coordinator's picks are checked by
 * SynopsisSubmissionController, only when they recommend, as before.
 */
final class SynopsisSubmissionDefinition extends FormDefinition
{
    public function title(): string
    {
        return 'Synopsis submission';
    }

    protected function notes(array $data): array
    {
        return self::afterViva($data)
            ? ['The written synopsis has been approved. This round confirms the viva, and starts with the PhD Coordinator uploading its minutes.']
            : [];
    }

    // The supervisor's and coordinator's panels were drawn straight into their steps.
    protected function unwrapped(): array
    {
        return ['faculty', 'phd_coordinator'];
    }

    protected function panels(array $data): array
    {
        $panels = [
            'student' => $this->scholar($data),
            'faculty' => $this->supervisor($data),
        ];
        // On the written round the coordinator only recommends, which the
        // chain's plain recommendation already draws.
        if (self::afterViva($data)) {
            $panels['phd_coordinator'] = $this->coordinator($data);
        }
        return $panels;
    }

    private static function afterViva(array $data): bool
    {
        return (int) ($data['round'] ?? 1) >= 2;
    }

    private function scholar(array $data): array
    {
        $storedPdf = $data['synopsis_pdf'] ?? null;
        $objectives = self::plain($data['objectives'] ?? []) ?? [];

        return [
            self::row([
                Field::text('Roll number')->value($data['roll_no'] ?? null),
                Field::text('Name')->value($data['name'] ?? null),
                Field::text('Date of revised IRB')->value($data['date_of_irb'] ?? null)->format('date'),
            ]),
            self::row([
                Field::text('Date of admission')->value($data['date_of_registration'] ?? null)->format('date'),
                Field::text('Department')->value($data['department'] ?? null),
                Field::text('Current status')->value($data['current_status'] ?? null),
            ]),
            self::row([
                Field::text('Address of correspondence')->value($data['address'] ?? null),
            ], space: 2),
            self::row([
                Field::text('Title of PhD thesis')->value($data['phd_title'] ?? null),
            ], space: 2),
            self::row([
                Field::table('Objectives of research', ['objective' => 'Objective'], array_map(fn ($objective) => ['objective' => $objective], $objectives)),
            ], space: 3),
            Field::publications(
                'Publications',
                ['sci', 'non_sci', 'patents', 'book', 'national', 'international'],
                'student_publications',
                self::mayEdit($data, 'student')
            )->with(['add_label' => 'Add publications']),
            // The category is the supervisor's declaration; the scholar reads
            // it here once it has been made.
            self::row([
                Field::text('Declared by the supervisor')->value($data['checklist_choice'] ?? null)->onlyIf(!empty($data['checklist_choice'])),
            ], space: 2, label: 'Publication category'),
            self::row([
                // A resubmission keeps the stored PDF unless a new one comes.
                Field::file('Upload PDF')
                    ->key('synopsis_pdf')
                    ->required(!$storedPdf)
                    ->editableBy('student')
                    ->rules(($storedPdf ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                    ->value($storedPdf),
            ]),
            self::row([
                Field::submit('Submit')->editableBy('student'),
            ]),
        ];
    }

    private function supervisor(array $data): array
    {
        // Progress is scored once, on the written round. After the viva the
        // figures are a record.
        $scoring = !self::afterViva($data);
        $scoringNow = $scoring && self::mayEdit($data, 'faculty');
        $previous = (float) ($data['previous_progress'] ?? 0);
        $options = self::plain($data['checklist_options'] ?? []) ?? [];
        $recommended = self::when('approval');

        $total = Field::text('Total quantum progress percentage');
        // While scoring, what the server will store: previous plus increase.
        $total = $scoringNow ? $total->runningTotal($previous, 'current_progress') : $total->value($data['total_progress'] ?? null);

        $increase = Field::text('Increase in quantum progress percentage')
            ->key('current_progress')
            ->required($scoring)
            ->editableBy('faculty')
            ->lockedIf(!$scoring)
            ->value($data['current_progress'] ?? null);
        if ($scoringNow) {
            $increase->capped(100 - $previous, 'Total progress cannot exceed 100%');
        }

        $category = $scoringNow
            ? Field::radio('', 'synopsis-checklist', array_map(fn ($option) => ['value' => $option['id'], 'title' => $option['label']], $options))
                ->key('checklist_option_id')
                ->editableBy('faculty')
                ->value($data['checklist_option_id'] ?? null)
            : Field::text('Declared')->value(($data['checklist_choice'] ?? null) ?: 'Not declared');

        $submit = Field::submit('Submit')
            ->editableBy('faculty')
            ->requires('approval', 'Choose Recommend or Not Recommend first.');
        if ($scoring && $options) {
            $submit->requiresWhen('approval', ['checklist_option_id'], 'Choose the publication category the scholar has met.');
        }

        return [
            Field::recommendation('supervisor')
                ->editableBy('faculty')
                ->value(self::stepAnswered($data, 'supervisor') ? ($data['approvals']['supervisor'] ?? null) : null),
            self::row([
                Field::text('Previous quantum progress percentage')->value($data['previous_progress'] ?? null),
            ], space: 2, showIf: [$recommended]),
            self::row([$increase], space: 2, showIf: [$recommended]),
            self::row([
                Field::notice('Supervisor has marked progress of student more than 20%', 'warning')->onlyIf($scoring),
            ], space: 2, showIf: [$recommended, self::when('current_progress', 'above', 20)]),
            self::row([$total], space: 2, showIf: [$recommended]),
            // The categories on offer are the ones this scholar qualifies for;
            // a scholar no condition covers is asked for nothing.
            self::row([
                $category->onlyIf($scoring && count($options) > 0),
            ], space: 2, label: 'Publication category met', showIf: [$recommended]),
            self::row([$submit]),
        ];
    }

    private function coordinator(array $data): array
    {
        // After the viva the coordinator holds the form until the minutes are in.
        $theirTurn = ($data['stage'] ?? null) === 'phd_coordinator' && self::mayEdit($data, 'phd_coordinator');
        $storedMinutes = $data['viva_minutes_pdf'] ?? null;

        $submit = Field::submit('Submit')
            ->editableBy('phd_coordinator')
            ->onlyIf($theirTurn)
            ->requires('approval', 'Choose Recommend or Not Recommend first.');
        if (!$storedMinutes) {
            $submit->requiresFile('viva_minutes_pdf', 'Upload the minutes of the viva first.');
        }

        return [
            Field::recommendation('phd_coordinator')
                ->editableBy('phd_coordinator')
                ->with(['more_fields' => $theirTurn, 'title' => 'Recommendation of PhD Coordinator, after the viva:']),
            self::row([
                Field::file('Minutes of the viva')
                    ->key('viva_minutes_pdf')
                    ->required()
                    ->editableBy('phd_coordinator')
                    ->lockedIf(!$theirTurn)
                    ->value($storedMinutes),
            ]),
            self::row([$submit]),
        ];
    }
}
