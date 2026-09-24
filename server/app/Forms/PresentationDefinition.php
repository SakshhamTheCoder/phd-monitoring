<?php

namespace App\Forms;

/**
 * A progress monitoring presentation: the scholar's report for the period and
 * its publications, then each supervisor's review with the progress increase
 * and attendance or contact hours. The committee's steps are plain
 * recommendations. PresentationController checks the supervisor's figures, as
 * before, and only on the first review.
 */
final class PresentationDefinition extends FormDefinition
{
    public function title(): string
    {
        // The title names the period; the view is built per form, so this is
        // filled in by view().
        return 'Progress monitoring';
    }

    public function view(array $data): array
    {
        $view = parent::view($data);
        $view['title'] = 'Progress monitoring ' . ($data['period_of_report'] ?? '');
        return $view;
    }

    // The supervisor's panel was drawn straight into its step.
    protected function unwrapped(): array
    {
        return ['faculty'];
    }

    protected function panels(array $data): array
    {
        return [
            'student' => $this->scholar($data),
            'faculty' => $this->supervisor($data),
        ];
    }

    private function scholar(array $data): array
    {
        $storedPdf = $data['presentation_pdf'] ?? null;
        $published = ($data['publication_count'] ?? 0) > 0 || count(self::plain($data['patents'] ?? []) ?? []) > 0;
        $count = fn (string $label, string $key) => Field::text($label)->required()->value($data[$key] ?? null);

        return [
            self::row([
                Field::text('Roll number')->value($data['roll_no'] ?? null),
                Field::text('Name')->value($data['name'] ?? null),
            ]),
            self::row([
                Field::text('Period of report')->value($data['period_of_report'] ?? null),
            ]),
            self::row([
                Field::text('Title of PhD thesis')->value($data['phd_title'] ?? null),
            ], space: 2),
            self::row([
                Field::text('Extension availed')->value(!empty($data['extention_availed']) ? 'Yes' : 'No'),
                Field::select('Teaching work done', [
                    ['value' => 'UG', 'title' => 'UG'],
                    ['value' => 'PG', 'title' => 'PG'],
                    ['value' => 'Both', 'title' => 'UG & PG (Both)'],
                    ['value' => 'None', 'title' => 'Other assignments'],
                ])
                    ->key('teaching_work')
                    ->required()
                    ->editableBy('student')
                    ->rules('required| in:UG,PG,Both,None')
                    ->value($data['teaching_work'] ?? null),
            ]),
            self::row([
                Field::select('Publication during the period under report', [
                    ['value' => true, 'title' => 'Yes'],
                    ['value' => false, 'title' => 'No'],
                ])
                    ->key('publication_under_report')
                    ->required()
                    ->editableBy('student')
                    ->with(['boolean' => true])
                    ->value($published),
            ], space: 2),
            // Kept on the page while hidden, so what was linked stays on screen.
            // The counts are worked out by the server from what is linked.
            self::group([
                self::row([$count('No. of papers in SCI/SCIE/SSCI/ABDC/AHCI journal', 'no_paper_sci_journal')], space: 2),
                self::row([$count('No. of papers in Scopus journal', 'no_paper_scopus_journal')], space: 2),
                self::row([$count('No. of papers in conferences under report', 'no_paper_conference')], space: 2),
                self::row([$count('Total number of papers', 'total_paper_sci_journal')], space: 2),
                Field::publications(
                    'Publications',
                    ['sci', 'non_sci', 'patents', 'book', 'national', 'international'],
                    'student_publications',
                    self::mayEdit($data, 'student')
                )->with(['add_label' => 'Link publications']),
            ], hiddenUnless: 'publication_under_report'),
            self::row(array_values(array_filter([
                // A resubmission keeps the stored PDF unless a new one comes.
                Field::file('Upload presentation PDF')
                    ->key('presentation_pdf')
                    ->required(!$storedPdf)
                    ->editableBy('student')
                    ->rules(($storedPdf ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480')
                    ->value($storedPdf),
                // Only when a sample has been set for this semester.
                !empty($data['ppt_file']) ? Field::file('Download sample PDF')->value($data['ppt_file']) : null,
            ]))),
            self::row([
                Field::submit('Submit')->editableBy('student'),
            ]),
        ];
    }

    private function supervisor(array $data): array
    {
        // A supervisor's own review is the answer they see; anyone else sees
        // the recorded one. An unreviewed presentation has no answer yet.
        $review = self::plain($data['current_review'] ?? null);
        $isFaculty = ($data['role'] ?? null) === 'faculty';
        $approval = $isFaculty
            ? (!empty($review['progress']) ? $review['progress'] === 'satisfactory' : null)
            : ($data['approvals']['supervisor'] ?? null);
        $comments = $isFaculty ? (($review['comments'] ?? null) ?: '') : (($data['comments']['supervisor'] ?? null) ?: '');
        $recommended = self::when('approval');
        // Attendance for a scholar with other assignments, contact hours for
        // one who teaches. The server asks for both on a first review, so the
        // one not shown is sent as it stands.
        $byAttendance = ($data['teaching_work'] ?? null) === 'None';
        $shown = $byAttendance ? ['attendance', '% Attendance'] : ['contact_hours', 'No. of contact hours'];
        $sentAsIs = $byAttendance ? 'contact_hours' : 'attendance';

        return [
            self::row([
                Field::table('', [
                    'faculty' => 'Name',
                    'progress' => ['title' => 'Progress', 'format' => 'title-case'],
                    'comments' => 'Comments',
                ], self::plain($data['supervisorReviews'] ?? []) ?? [])->onlyWhile('locked', 'faculty'),
            ], space: 3, label: 'Supervisor(s) review'),
            Field::recommendation('supervisor')
                ->editableBy('faculty')
                ->value($approval)
                ->with([
                    'sends_comments' => true,
                    'comments' => $comments,
                    'is_locked' => !self::mayEdit($data, 'faculty'),
                ]),
            self::row([
                Field::text('Previous quantum progress percentage')->value($data['current_progress'] ?? null),
            ], space: 2, showIf: [$recommended]),
            self::row([
                Field::text('Increase in quantum progress percentage')
                    ->key('progress')
                    ->required()
                    ->editableBy('faculty')
                    ->value($data['progress'] ?? null),
            ], space: 2, showIf: [$recommended]),
            self::row([
                Field::notice('Supervisor has marked progress of student more than 20%', 'warning'),
            ], space: 2, showIf: [$recommended, self::when('progress', 'above', 20)]),
            self::row([
                Field::text('Total quantum progress percentage')
                    ->runningTotal(isset($data['current_progress']) ? (float) $data['current_progress'] : null, 'progress'),
            ], space: 2, showIf: [$recommended]),
            self::row([
                Field::text($shown[1])
                    ->key($shown[0])
                    ->required()
                    ->editableBy('faculty')
                    ->value($data[$shown[0]] ?? null),
            ], showIf: [$recommended]),
            Field::hidden($sentAsIs)->editableBy('faculty')->value($data[$sentAsIs] ?? null),
            self::row([
                Field::submit('Submit')
                    ->editableBy('faculty')
                    ->requires('approval', 'Choose Recommend or Not Recommend first.'),
            ]),
        ];
    }
}
