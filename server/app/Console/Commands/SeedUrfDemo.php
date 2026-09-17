<?php

namespace App\Console\Commands;

use App\Models\Faculty;
use App\Models\Publication;
use App\Models\Role;
use App\Models\UgBranch;
use App\Models\UgStudent;
use App\Models\UrfApplication;
use App\Models\UrfFellow;
use App\Models\UrfReport;
use App\Models\UrfReportWindow;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Demonstration URF data for one student: a finished project for last year and
 * a running one for this year, both with a mentor, the stipend details, the
 * reports their sessions expect, and a paper filed with a report.
 *
 * Safe to run more than once. Everything is keyed on (student, session), so a
 * second run corrects the same two projects rather than adding more, and the
 * command touches no account or project other than the ones it names.
 *
 *   php artisan urf:seed-demo ug1@gmail.com --mentor=mentor@thapar.edu
 *
 * Add --undo to remove exactly what it created.
 */
class SeedUrfDemo extends Command
{
    protected $signature = 'urf:seed-demo
        {email : the UG student the projects belong to}
        {--mentor= : the mentor, by email or faculty code, and the first internal faculty member otherwise}
        {--branch= : the UG branch code or id, used only when the account has no branch yet}
        {--sessions= : comma separated years, and last year plus this year otherwise}
        {--verify : mark the address confirmed, for a demonstration account that never followed its link}
        {--undo : remove the projects this command created for that student}';

    protected $description = 'Fill in demonstration URF projects for one UG student';

    public function handle(): int
    {
        $student = User::where('email', $this->argument('email'))->first();
        if (!$student) {
            $this->error('No account for ' . $this->argument('email') . '. Create the student first, or let the URF page do it.');
            return self::FAILURE;
        }

        $sessions = $this->sessions();

        if ($this->option('undo')) {
            return $this->undo($student, $sessions);
        }

        $record = $student->ugStudent ?: $this->attachUgRecord($student);
        if (!$record) {
            return self::FAILURE;
        }

        $mentor = $this->mentor();
        if (!$mentor) {
            return self::FAILURE;
        }

        if ($student->email_verified_at === null) {
            if ($this->option('verify')) {
                $student->forceFill(['email_verified_at' => now()])->save();
                $this->warn('The address was unconfirmed, and is now marked confirmed so the account can sign in.');
            } else {
                $this->warn('The address is not confirmed yet, so this account cannot sign in. Follow the link in its sign-up mail, or run this again with --verify.');
            }
        }

        $this->line('Student: ' . $student->name() . ' (' . $student->email . '), roll ' . $record->roll_no);
        $this->line('Mentor:  ' . $mentor->user?->name() . ' (' . $mentor->faculty_code . ')');

        foreach ($sessions as $index => $session) {
            // The older session is the finished project, the newest the running one.
            $finished = $session !== max($sessions);
            $this->seedSession($student, $record, $mentor, (int) $session, $finished);
        }

        $this->newLine();
        $this->info('Done. Sign in as the student to see the projects, and as the mentor to see them under URF.');

        return self::SUCCESS;
    }

    /** @return array<int, int> */
    private function sessions(): array
    {
        $given = $this->option('sessions');
        $sessions = $given
            ? array_map('intval', array_filter(array_map('trim', explode(',', $given))))
            : [(int) now()->year - 1, (int) now()->year];

        sort($sessions);

        return $sessions;
    }

    private function attachUgRecord(User $student): ?UgStudent
    {
        $branch = $this->branch();
        if (!$branch) {
            $this->error('No UG branches exist yet. Add one on the URF configuration page, or pass --branch.');
            return null;
        }

        // The roll number the institute address carries, when it carries one.
        $roll = preg_match('/(\d{6,})/', $student->email, $matches)
            ? $matches[1]
            : '1' . str_pad((string) $student->id, 8, '0', STR_PAD_LEFT);

        $record = $student->ugStudent()->create([
            'roll_no' => $roll,
            'branch_id' => $branch->id,
            'year' => 4,
        ]);

        $ugRole = Role::where('role', 'ug_student')->value('id');
        if ($ugRole && !$student->current_role_id) {
            $student->forceFill(['role_id' => $ugRole, 'current_role_id' => $ugRole, 'default_role_id' => $ugRole])->save();
        }

        $this->warn('The account had no UG record, so one was added: roll ' . $roll . ', ' . $branch->code . ', year 4.');

        return $record;
    }

    private function branch(): ?UgBranch
    {
        $given = $this->option('branch');

        return $given
            ? UgBranch::where('code', $given)->orWhere('id', $given)->first()
            : UgBranch::orderBy('id')->first();
    }

    private function mentor(): ?Faculty
    {
        $given = $this->option('mentor');

        $mentor = $given
            ? Faculty::where('type', 'internal')
                ->where(fn ($query) => $query
                    ->where('faculty_code', $given)
                    ->orWhereHas('user', fn ($u) => $u->where('email', $given)))
                ->with('user')
                ->first()
            : Faculty::where('type', 'internal')->whereHas('user')->with('user')->orderBy('faculty_code')->first();

        if (!$mentor) {
            $this->error($given ? "No internal faculty member matches {$given}." : 'No internal faculty exist to mentor the project.');
        }

        return $mentor;
    }

    private function seedSession(User $student, UgStudent $record, Faculty $mentor, int $session, bool $finished): void
    {
        $this->newLine();
        $this->line("Session {$session}: " . ($finished ? 'a finished project' : 'a running project'));

        DB::transaction(function () use ($student, $record, $mentor, $session, $finished) {
            $this->reportWindows($session);

            $application = UrfApplication::where('user_id', $student->id)->where('session', $session)->first()
                ?? (new UrfApplication())->forceFill(['user_id' => $student->id, 'session' => $session]);

            $application->fill([
                'project_title' => $finished
                    ? "Low cost air quality sensing across the campus ({$session})"
                    : "On device speech models for regional languages ({$session})",
                'student1_name' => $student->name(),
                'student1_roll_no' => $record->roll_no,
                'student1_branch_id' => $record->branch_id,
                'student1_year' => $record->year ?: 4,
                'student1_gender' => $student->gender ?: 'Male',
                'student1_email' => $student->email,
                'student1_phone' => $student->phone ?: '9876500000',
                'mentor1_faculty_code' => $mentor->faculty_code,
            ]);
            $application->proposal = $application->proposal ?: $this->placeholderPdf("urf_proposal", "Proposal, session {$session}");
            $application->status = 'selected';
            // Read and approved by everyone, so the project reads as it would
            // after the office had worked through it.
            $application->forceFill([
                'stage' => UrfApplication::COMPLETE,
                'mentor_approval' => true,
                'mentor_comments' => 'Well scoped. Happy to mentor.',
                'adordc_approval' => true,
                'adordc_comments' => 'Recommended.',
                'dordc_approval' => true,
                'dordc_comments' => 'Selected for the fellowship.',
                'history' => $this->history($student, $mentor, $session),
            ])->save();

            $this->fellow($application, $student);

            $reports = $finished ? ['half_yearly', 'final'] : ['half_yearly'];
            foreach ($reports as $type) {
                $report = $this->report($application, $student, $type, $session);
                $this->paper($application, $student, $report, $session);
            }

            $this->line('  application, stipend details and ' . count($reports) . ' report(s) in place');
        });
    }

    /** A project cannot take a report unless its session has a round open for it. */
    private function reportWindows(int $session): void
    {
        foreach (['half_yearly' => [6, 9], 'final' => [10, 12]] as $type => [$from, $to]) {
            $window = UrfReportWindow::where('session', $session)->where('type', $type)->first() ?? new UrfReportWindow();
            $window->fill([
                'session' => $session,
                'type' => $type,
                'opens_on' => sprintf('%d-%02d-01', $session, $from),
                'closes_on' => sprintf('%d-%02d-28', $session, $to),
                'notes' => 'Demonstration round.',
            ])->save();
        }
    }

    private function fellow(UrfApplication $application, User $student): void
    {
        $keys = ['urf_application_id' => $application->id, 'user_id' => $student->id];
        $fellow = UrfFellow::where($keys)->first() ?? (new UrfFellow())->forceFill($keys);

        $fellow->fill([
            'full_name' => $student->name(),
            'dob' => '2004-07-14',
            'gender' => $student->gender ?: 'Male',
            'father_name' => 'Demonstration Parent',
            // Shaped like the real thing so the forms validate, but not anybody's.
            'pan' => 'ABCDE1234F',
            'aadhaar' => '999988887777',
            'bank_name' => 'State Bank of India',
            'account_no' => '30012345678',
            'ifsc' => 'SBIN0001234',
        ]);
        $fellow->forceFill([
            'stage' => UrfFellow::COMPLETE,
            'mentor_approval' => true,
            'adordc_approval' => true,
            'dordc_approval' => true,
        ])->save();
    }

    private function report(UrfApplication $application, User $student, string $type, int $session): UrfReport
    {
        $keys = ['urf_application_id' => $application->id, 'user_id' => $student->id, 'type' => $type];
        $report = UrfReport::where($keys)->first() ?? (new UrfReport())->forceFill($keys);

        $report->fill([
            'type' => $type,
            'conference_presentation' => $type === 'final'
                ? 'Presented at the institute research colloquium, ' . $session . '.'
                : 'Poster at the department review, ' . $session . '.',
        ]);
        $report->report = $report->report ?: $this->placeholderPdf('urf_report', ucfirst(str_replace('_', ' ', $type)) . " report, session {$session}");
        $report->forceFill([
            'stage' => UrfReport::COMPLETE,
            'mentor_approval' => true,
            'mentor_comments' => 'Reviewed.',
            'adordc_approval' => true,
            'dordc_approval' => true,
        ])->save();

        return $report;
    }

    /** A paper filed with the report, the way the student's library copies one in. */
    private function paper(UrfApplication $application, User $student, UrfReport $report, int $session): void
    {
        $exists = Publication::where('form_id', $report->id)
            ->where('form_type', 'urf_report')
            ->where('user_id', $student->id)
            ->exists();
        if ($exists) {
            return;
        }

        Publication::forceCreate([
            'user_id' => $student->id,
            'urf_application_id' => $application->id,
            'form_id' => $report->id,
            'form_type' => 'urf_report',
            'title' => 'A low cost approach to campus scale sensing',
            'authors' => $student->name() . ', mentor',
            'publication_type' => 'conference',
            'type' => 'national',
            'status' => 'published',
            'name' => 'National Conference on Applied Computing',
            'year' => $session,
            'country' => 'India',
            'state' => 'Punjab',
            'city' => 'Patiala',
            'mode' => 'offline',
            'funding' => 'URF',
        ]);
    }

    /** @return array<int, array<string, string|null>> */
    private function history(User $student, Faculty $mentor, int $session): array
    {
        $at = fn (int $month) => sprintf('%d-%02d-10T10:00:00+05:30', $session, $month);

        return [
            ['step' => 'student', 'by' => $student->name(), 'decision' => 'submitted', 'comments' => null, 'at' => $at(3)],
            ['step' => 'mentor', 'by' => $mentor->user?->name(), 'decision' => 'approve', 'comments' => 'Well scoped. Happy to mentor.', 'at' => $at(4)],
            ['step' => 'adordc', 'by' => 'ADoRDC', 'decision' => 'approve', 'comments' => 'Recommended.', 'at' => $at(4)],
            ['step' => 'dordc', 'by' => 'DoRDC', 'decision' => 'approve', 'comments' => 'Selected for the fellowship.', 'at' => $at(5)],
        ];
    }

    /**
     * A one page PDF where an upload would be, so the links on the page open
     * something instead of 404ing. Written by hand: no library needed for a
     * file whose only job is to exist.
     */
    private function placeholderPdf(string $formName, string $label): string
    {
        $text = str_replace(['(', ')'], '', $label);
        $body = "1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
            . "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
            . "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
            . "4 0 obj<</Length 90>>stream\nBT /F1 14 Tf 72 760 Td ({$text}) Tj ET\nendstream endobj\n"
            . "5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n";
        $pdf = "%PDF-1.4\n" . $body . "trailer<</Root 1 0 R>>\n%%EOF\n";

        $name = $formName . '_demo_' . now()->format('YmdHis') . mt_rand(1000, 9999) . '.pdf';
        Storage::disk('public')->put("uploads/{$formName}/{$name}", $pdf);

        // The path shape the upload trait stores, so FileLink resolves it.
        return "/app/public/uploads/{$formName}/{$name}";
    }

    private function undo(User $student, array $sessions): int
    {
        $applications = UrfApplication::where('user_id', $student->id)->whereIn('session', $sessions)->get();
        if ($applications->isEmpty()) {
            $this->info('Nothing to remove.');
            return self::SUCCESS;
        }

        foreach ($applications as $application) {
            Publication::where('urf_application_id', $application->id)->delete();
            // Fellows and reports go with the application, by foreign key.
            $application->delete();
            UrfReportWindow::where('session', $application->session)->where('notes', 'Demonstration round.')->delete();
            $this->line('Removed session ' . $application->session);
        }

        return self::SUCCESS;
    }
}
