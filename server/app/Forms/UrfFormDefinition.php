<?php

namespace App\Forms;

/**
 * One URF form of one project (application, additional information, or a
 * report), as its chain is read: what the student filed, locked, then each
 * approver's recommendation. Built from UrfController::formShow's answer.
 *
 * The student fills these forms on their own pages, so every field here is
 * read-only. A step's recommendation posts to the form's decision endpoint,
 * named in step_options, rather than to the page's own path.
 */
final class UrfFormDefinition extends FormDefinition
{
    private const FINAL_REPORT = ['approved' => 'Approved', 'filed' => 'Filed, in review'];

    // The kinds of publication the portal records; it has no Scopus flag, so a
    // reviewer reads eligibility from these.
    private const PUBLICATION_KINDS = [
        'journal:sci' => 'SCI journal',
        'journal:non-sci' => 'Non-SCI journal',
        'conference:international' => 'International conference',
        'conference:national' => 'National conference',
    ];

    public const PUBLICATION_LISTS = ['sci', 'non_sci', 'international', 'national', 'book', 'patents'];

    public function __construct(
        private readonly string $form,
        private readonly string $name,
        private readonly int $formId,
        private readonly bool $mayReject,
    ) {}

    public function title(): string
    {
        return $this->name;
    }

    protected function notes(array $data): array
    {
        return ["URF {$data['session']} · {$data['project_title']}"];
    }

    protected function stepOptions(): array
    {
        $options = [];
        foreach (['mentor', 'adordc', 'dordc'] as $step) {
            $options[$step] = [
                // Only the DORDC ends a project, and only on the application.
                'allow_rejection' => $step === 'dordc' && $this->mayReject,
                'submit_path' => "/urf/{$this->form}/{$this->formId}/decision",
            ];
        }
        return $options;
    }

    protected function panels(array $data): array
    {
        $application = $data['application'] ?? [];
        return ['student' => match ($this->form) {
            'urf-application' => $this->application($application),
            'urf-additional-info' => $this->additional($data['filled'] ?? []),
            default => $this->report($data['filled'] ?? [], $application),
        }];
    }

    private function application(array $application): array
    {
        $mentors = self::mentors($application);
        $rows = [
            self::row([Field::text('Title of Project')->value($application['project_title'] ?? null)], space: 3),
            self::row([Field::table('Team members', [
                'name' => 'Name', 'roll_no' => 'Roll number', 'branch' => 'Branch', 'year' => 'Year',
                'gender' => 'Gender', 'email' => 'Official email', 'phone' => 'Phone',
            ], self::students($application))], space: 3),
            self::row([Field::table('Faculty mentors', [
                'name' => 'Name', 'email' => 'Email', 'designation' => 'Designation', 'department' => 'Department',
            ], array_map(fn ($mentor) => [
                'name' => self::facultyName($mentor),
                'email' => $mentor['user']['email'] ?? null,
                'designation' => $mentor['designation'] ?? null,
                'department' => $mentor['department']['name'] ?? 'N/A',
            ], $mentors))], space: 3),
        ];
        // Only reviewers receive the students' other projects.
        if (isset($application['other_projects'])) {
            $rows[] = self::row([Field::table('Eligibility: other URF projects', [
                'student' => 'Student', 'session' => 'Session', 'project_title' => 'Project', 'status' => 'Status',
                'final_report' => 'Final report', 'publications' => 'Publications',
            ], self::otherProjects($application['other_projects']))], space: 3);
        }
        $rows[] = self::row([Field::file('Project proposal')->value($application['proposal'] ?? null)], space: 3);
        $rows[] = self::row([
            Field::text('Session')->value(isset($application['session']) ? "URF {$application['session']}" : null),
            Field::text('Applied On')->value($application['applied_on'] ?? null)->format('date'),
            Field::text('Faculty Mentors')->value(implode(', ', array_map([self::class, 'facultyName'], $mentors))),
        ]);
        return $rows;
    }

    private function additional(array $filled): array
    {
        return [self::row([
            Field::text('Submitted By')->value($filled['submitted_by'] ?? null),
            Field::text('Full Name (as per PAN Card)')->value($filled['full_name'] ?? null),
            Field::text('Date of Birth')->value($filled['dob'] ?? null)->format('date'),
            Field::text('Gender')->value($filled['gender'] ?? null),
            Field::text("Father's Name")->value($filled['father_name'] ?? null),
            Field::text('PAN Card Number')->value($filled['pan'] ?? null),
            Field::text('Aadhaar Card Number')->value($filled['aadhaar'] ?? null),
            Field::text('Bank Name')->value($filled['bank_name'] ?? null),
            Field::text('Bank Account Number')->value($filled['account_no'] ?? null),
            Field::text('IFSC Code')->value($filled['ifsc'] ?? null),
        ])];
    }

    private function report(array $filled, array $application): array
    {
        $mentors = self::mentors($application);
        return [
            self::row([Field::text('Title of Project')->value($application['project_title'] ?? null)], space: 3),
            self::row([
                Field::text('Submitted By')->value($filled['submitted_by'] ?? null),
                Field::text('Faculty Mentor Name')->value(implode(', ', array_map([self::class, 'facultyName'], $mentors))),
                Field::text('Faculty Mentor Department')->value(implode(', ', array_filter(array_map(fn ($m) => $m['department']['name'] ?? null, $mentors)))),
                Field::text('Conference Presentation')->value($filled['conference_presentation'] ?? null),
                Field::text('Submitted On')->value($filled['submitted_on'] ?? null)->format('date'),
            ]),
            self::row([Field::file($this->name)->value($filled['report'] ?? null)], space: 3),
            // Read from the answer's top level, where formShow puts the report's lists.
            // The project's students in bold among the authors, not the reader.
            Field::publications('Publications', self::PUBLICATION_LISTS, 'library', false)
                ->with(['highlight' => array_values(array_filter([$application['student1_name'] ?? null, $application['student2_name'] ?? null]))]),
        ];
    }

    private static function mentors(array $application): array
    {
        return array_values(array_filter([$application['mentor1'] ?? null, $application['mentor2'] ?? null]));
    }

    public static function facultyName(array $faculty): string
    {
        return trim(($faculty['user']['first_name'] ?? '') . ' ' . ($faculty['user']['last_name'] ?? ''));
    }

    private static function students(array $record): array
    {
        $students = [];
        foreach ([1, 2] as $n) {
            if (empty($record["student{$n}_name"])) {
                continue;
            }
            $students[] = [
                'name' => $record["student{$n}_name"],
                'roll_no' => $record["student{$n}_roll_no"] ?? null,
                'branch' => $record["student{$n}_branch"]['name'] ?? 'N/A',
                'year' => self::yearLabel($record["student{$n}_year"] ?? null),
                'gender' => $record["student{$n}_gender"] ?? null,
                'email' => $record["student{$n}_email"] ?? null,
                'phone' => $record["student{$n}_phone"] ?? null,
            ];
        }
        return $students;
    }

    /** "3rd Year" for 3, as the web names it. */
    private static function yearLabel(mixed $year): string
    {
        if (!$year) {
            return 'N/A';
        }
        $year = (int) $year;
        return $year . (['', 'st', 'nd', 'rd'][$year] ?? 'th') . ' Year';
    }

    private static function otherProjects(array $others): array
    {
        $rows = [];
        foreach ($others as $other) {
            if (!$other['projects']) {
                $rows[] = ['student' => $other['student'], 'session' => 'N/A', 'project_title' => 'No other URF project',
                    'status' => 'N/A', 'final_report' => 'N/A', 'publications' => 'N/A'];
                continue;
            }
            foreach ($other['projects'] as $project) {
                $rows[] = [
                    'student' => $other['student'],
                    'session' => "URF {$project['session']}",
                    'project_title' => $project['project_title'],
                    'status' => ucfirst((string) $project['status']),
                    'final_report' => self::FINAL_REPORT[$project['final_report'] ?? ''] ?? 'Not filed',
                    'publications' => self::publicationSummary($project['publications'] ?? []),
                ];
            }
        }
        return $rows;
    }

    private static function publicationSummary(array $counts): string
    {
        $parts = [];
        foreach ($counts as $kind => $n) {
            $parts[] = "{$n} " . (self::PUBLICATION_KINDS[$kind] ?? (str_starts_with($kind, 'book') ? 'Book' : $kind));
        }
        return $parts ? implode(', ', $parts) : 'None linked';
    }
}
