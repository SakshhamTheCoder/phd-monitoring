<?php

namespace App\Console\Commands;

use App\Http\Controllers\ConstituteOfIRBController;
use App\Http\Controllers\ExternalReviewController;
use App\Http\Controllers\IrbSubController;
use App\Http\Controllers\ListOfExaminersController;
use App\Http\Controllers\PresentationController;
use App\Http\Controllers\PublicationController;
use App\Http\Controllers\ResearchExtentionController;
use App\Http\Controllers\StatusChangeFormController;
use App\Http\Controllers\StudentSemesterOffFormController;
use App\Http\Controllers\SupervisorAllocationController;
use App\Http\Controllers\SupervisorChangeFormController;
use App\Http\Controllers\SynopsisSubmissionController;
use App\Http\Controllers\ThesisExtentionController;
use App\Http\Controllers\ThesisSubmissionController;
use App\Models\Approval;
use App\Models\ConstituteOfIRB;
use App\Models\ExaminersRecommendation;
use App\Models\Faculty;
use App\Models\IrbNomineeCognate;
use App\Models\IrbOutsideExpert;
use App\Models\IrbSubForm;
use App\Models\IRBCommittee;
use App\Models\ListOfExaminersForm;
use App\Models\OutsideExpert;
use App\Models\Presentation;
use App\Models\Publication;
use App\Models\ResearchExtentionsForm;
use App\Models\Role;
use App\Models\Semester;
use App\Models\Student;
use App\Models\StudentSemesterOffForm;
use App\Models\StudentStatusChangeForms;
use App\Models\Supervisor;
use App\Models\SupervisorAllocation;
use App\Models\SupervisorChangeForm;
use App\Models\SynopsisSubmission;
use App\Models\ThesisExtentionForm;
use App\Models\ThesisSubmission;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

/**
 * Take one student through every form in the portal, from an empty account to a
 * complete approval history, so a supervisor account has something to open.
 *
 *   php artisan demo:forms                          fill and approve everything
 *   php artisan demo:forms --status                 show where each form stands
 *   php artisan demo:forms --student=a@b.c --supervisor=d@e.f
 *
 * Every step goes through the real controller the browser would hit, acting as
 * whoever owns that step. Nothing about the workflow is reimplemented here, so
 * the rows this leaves behind (locks, approvals, history, committees, uploads)
 * are the same rows a person clicking through the portal would have produced.
 *
 * Two things keep it from reaching anyone. Mail is switched to the array
 * transport for the run, which is the only reason the outside expert's review
 * request does not actually go out, and the acting role is set on an in-memory
 * copy of each user, so no real account has its current role moved.
 *
 * Forms already marked complete are skipped, so a second run is a no-op rather
 * than a duplicate.
 */
class DemoForms extends Command
{
    protected $signature = 'demo:forms
        {--student=teststu@gmail.com : Email of the student whose forms are filled}
        {--supervisor=ajain3_be22@thapar.edu : Email of the faculty who must end up supervising}
        {--director=director@thapar.edu : Email of the director, created if no such account exists}
        {--password=DemoPass#2026 : Password for the director account, if one has to be created}
        {--status : Show where each form stands and change nothing}';

    protected $description = 'Fill in and approve every form for one student, so their supervisor can see a full history';

    /**
     * The order forms are run in is the order the portal unlocks them: supervisor
     * allocation creates the supervisors and the examiner form, the IRB creates
     * the doctoral committee, and the revised IRB creates the synopsis and thesis
     * forms. Supervisor change comes last because it swaps a supervisor out.
     */
    private const FLOW = [
        'supervisor-allocation' => [SupervisorAllocationController::class, SupervisorAllocation::class],
        'irb-constitution'      => [ConstituteOfIRBController::class, ConstituteOfIRB::class],
        'irb-submission'        => [IrbSubController::class, IrbSubForm::class],
        'presentation'          => [PresentationController::class, Presentation::class],
        'synopsis-submission'   => [SynopsisSubmissionController::class, SynopsisSubmission::class],
        'thesis-submission'     => [ThesisSubmissionController::class, ThesisSubmission::class],
        'list-of-examiners'     => [ListOfExaminersController::class, ListOfExaminersForm::class],
        'status-change'         => [StatusChangeFormController::class, StudentStatusChangeForms::class],
        'semester-off'          => [StudentSemesterOffFormController::class, StudentSemesterOffForm::class],
        'irb-extension'         => [ResearchExtentionController::class, ResearchExtentionsForm::class],
        'thesis-extension'      => [ThesisExtentionController::class, ThesisExtentionForm::class],
        'supervisor-change'     => [SupervisorChangeFormController::class, SupervisorChangeForm::class],
    ];

    /**
     * The three forms that show the student's publications, and the form_type
     * each one files its copies under. Linking replicates the student's own
     * publication into a copy owned by that form, which is what these read back.
     */
    private const LINKED_FORMS = [
        'presentation' => 'progress',
        'synopsis-submission' => 'synopsis',
        'thesis-submission' => 'thesis',
    ];

    private const PUBLICATION_TITLE = 'Transport limitations in packed bed reactors: a modelling study';

    /** The smallest byte sequence file(1) still recognises as a PDF, which is all mimes:pdf asks for. */
    private const PDF = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        . "2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        . "3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n"
        . "trailer<</Root 1 0 R>>\n%%EOF\n";

    private Student $student;
    private User $studentUser;

    /** Faculty codes of the two supervisors. The first is the one that must survive the run. */
    private array $supervisorCodes = [];

    /** Faculty codes put forward as cognate nominees, three of them, none a supervisor. */
    private array $cognateCodes = [];

    /**
     * The cognate expert the HOD adds. Kept apart from the nominees because DoRDC
     * puts both on the IRB committee, and one faculty cannot sit on it twice.
     */
    private int $chairmanCode;

    /** The faculty code supervisor change moves to, kept clear of everyone else's role. */
    private int $replacementCode;

    private array $outsideExpertIds = [];

    private ?User $directorUser = null;

    public function handle(): int
    {
        // The revised IRB emails the outside expert as soon as the supervisors
        // sign off. Nothing should leave the building over a seeding run.
        config(['mail.default' => 'array']);

        if (!$this->resolveCast()) {
            return self::FAILURE;
        }

        if ($this->option('status')) {
            return $this->showStatus();
        }

        foreach (array_keys(self::FLOW) as $type) {
            try {
                $this->runForm($type);
            } catch (\Throwable $e) {
                $this->newLine();
                $this->error("{$type}: {$e->getMessage()}");
                $this->warn('Stopped here. Fix the above, then run again. Finished forms are skipped.');
                return self::FAILURE;
            }
        }

        // Kept out of the loop above so it still runs on a second pass, when every
        // form is already complete and skipped. Linking has no stage of its own,
        // so a finished form takes a publication just as well as an open one.
        $this->linkPublications();

        $this->newLine();
        $this->info('Every form is filled in and approved.');
        $this->newLine();

        return $this->showStatus();
    }

    /**
     * Find everyone the run needs to act as. Everything is looked up from the
     * student's own department rather than hard-coded, so this works against any
     * database that has the roles filled in.
     */
    private function resolveCast(): bool
    {
        $studentUser = User::where('email', $this->option('student'))->first();
        if (!$studentUser || !$studentUser->student) {
            $this->error('No student account found for ' . $this->option('student'));
            return false;
        }

        $supervisor = User::where('email', $this->option('supervisor'))->first();
        if (!$supervisor || !$supervisor->faculty) {
            $this->error('No faculty account found for ' . $this->option('supervisor'));
            return false;
        }

        $this->studentUser = $studentUser;
        $this->student = $studentUser->student;

        $department = $this->student->department;
        foreach (['hod' => $department?->hod, 'adordc' => $department?->adordc] as $what => $faculty) {
            if (!$faculty?->user) {
                $this->error("The student's department has no {$what} set. Set one and run again.");
                return false;
            }
        }
        if (!$department->phdCoordinators()->exists()) {
            $this->error("The student's department has no PhD coordinator. Add one and run again.");
            return false;
        }
        // Three institute-wide steps need someone holding the role. DoRDC and DRA
        // are always staffed on a real database, but nobody is appointed director
        // in the portal, so that one account is created here if it is missing.
        foreach (['dordc', 'dra'] as $role) {
            if (!$this->roleHolder($role)) {
                $this->error("No user holds the {$role} role. Create one and run again.");
                return false;
            }
        }
        if (!$this->director()) {
            return false;
        }

        // Everyone who already has a say on this student's forms, and so must not
        // be picked for a second part. A supervisor cannot be their own cognate,
        // and the HOD or coordinator sitting on the doctoral committee would make
        // the synopsis and presentation forms route their own step to the
        // committee instead (both controllers treat committee membership as
        // outranking the current role).
        $spokenFor = [
            $supervisor->faculty->faculty_code,
            $department->hod_id,
            $department->adordc_id,
            ...$department->phdCoordinators->pluck('faculty_id')->all(),
            ...$this->student->doctoralCommittee->pluck('faculty_code')->all(),
        ];

        $spare = Faculty::where('department_id', $this->student->department_id)
            ->whereNotIn('faculty_code', $spokenFor)
            ->whereHas('user')
            ->orderBy('faculty_code')
            ->pluck('faculty_code')
            ->all();

        // A second supervisor, three cognate nominees, a cognate expert, and the
        // supervisor that the change form swaps in.
        if (count($spare) < 6) {
            $this->error("The student's department needs at least six other faculty to fill every part.");
            return false;
        }

        $this->supervisorCodes = [$supervisor->faculty->faculty_code, $spare[0]];
        $this->cognateCodes = array_slice($spare, 1, 3);
        $this->chairmanCode = $spare[4];
        $this->replacementCode = $spare[5];
        $this->outsideExpertIds = $this->outsideExperts();

        $this->line('  student     ' . $studentUser->email . '  (' . $this->student->roll_no . ')');
        $this->line('  supervisors ' . implode(', ', $this->supervisorCodes));
        $this->line('  department  ' . $department->name);

        return true;
    }

    /**
     * Three outside experts, because the HOD step refuses any other number. They
     * sit under .invalid, a TLD reserved so it can never resolve, since one of
     * them ends up on the student's IRB committee for good.
     */
    private function outsideExperts(): array
    {
        $ids = [];
        foreach (['a', 'b', 'c'] as $suffix) {
            $ids[] = OutsideExpert::updateOrCreate(
                ['email' => "demo.expert.{$suffix}@demo.invalid"],
                [
                    'first_name' => 'Demo',
                    'last_name' => 'Expert ' . strtoupper($suffix),
                    'designation' => 'Professor',
                    'institution' => 'Demo Institute',
                    'department' => 'Demo Department',
                ]
            )->id;
        }

        return $ids;
    }

    private function runForm(string $type): void
    {
        [, $model] = self::FLOW[$type];

        $form = $model::where('student_id', $this->student->roll_no)->orderByDesc('id')->first();

        if ($form && $form->completion === 'complete') {
            $this->line(sprintf('  %-22s already complete', $type));
            return;
        }

        if (!$form) {
            $form = $this->createForm($type, $model);
        }

        // Both of these forms end by writing rows that are unique per student and
        // inserted outright, so anything already there would collide, whether it
        // was left by an earlier run or by a run that stopped part way. The form
        // is about to write the current set, so clear the old one first.
        if ($type === 'supervisor-allocation') {
            Supervisor::where('student_id', $this->student->roll_no)->delete();
        }
        if ($type === 'irb-constitution') {
            IRBCommittee::where('student_id', $this->student->roll_no)->delete();
        }

        $this->drive($type, $form);
        $this->line(sprintf('  %-22s filled and approved', $type));
    }

    /**
     * Only the examiner form has no instance waiting: it is the one form a
     * supervisor opens rather than the student, so nothing creates it up front.
     */
    private function createForm(string $type, string $model)
    {
        if ($type !== 'list-of-examiners') {
            throw new \RuntimeException('no form to fill in, and this type cannot be created here');
        }

        $supervisor = $this->actingAs(Faculty::find($this->supervisorCodes[0])->user, 'faculty');
        $request = Request::create('/', 'POST', ['roll_no' => $this->student->roll_no]);
        $request->setUserResolver(fn () => $supervisor);
        Auth::setUser($supervisor);

        $response = app(ListOfExaminersController::class)->createForm($request);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('could not create it: ' . ($response->getData(true)['message'] ?? 'unknown'));
        }

        return $model::where('student_id', $this->student->roll_no)->orderByDesc('id')->firstOrFail();
    }

    /**
     * Walk a form to completion, submitting as whoever owns the stage it is
     * sitting on. Steps with more than one approver, where every supervisor or
     * every committee member has to sign, are handled by submitting as each in
     * turn until the form moves on.
     */
    private function drive(string $type, $form): void
    {
        $seen = [];

        while ($form->completion !== 'complete') {
            $stage = $form->stage;

            // A stage that comes round twice means nobody on it can move it on.
            if (isset($seen[$stage])) {
                throw new \RuntimeException("stuck at the {$stage} step");
            }
            $seen[$stage] = true;

            if ($stage === 'external') {
                $this->externalReview($form);
                $form = $form->fresh();
                continue;
            }

            foreach ($this->actorsFor($stage) as [$user, $role]) {
                $this->submitStep($type, $form, $user, $role);
                $form = $form->fresh();
                if ($form->stage !== $stage) {
                    break;
                }
            }

            if ($form->stage === $stage) {
                throw new \RuntimeException("the {$stage} step did not move the form on");
            }
        }
    }

    /** Everyone who can act on a stage, in the order they should be asked. */
    private function actorsFor(string $stage): array
    {
        $department = $this->student->department;

        // Read the supervisors and the committee back out of the database rather
        // than off the student, whose copies were loaded before earlier forms
        // added to them.
        return match ($stage) {
            'student' => [[$this->studentUser, 'student']],
            'supervisor' => $this->student->supervisors()->get()
                ->map(fn ($faculty) => [$faculty->user, 'faculty'])->all(),
            'doctoral' => $this->student->doctoralCommittee()->get()
                ->map(fn ($faculty) => [$faculty->user, 'doctoral'])->all(),
            'phd_coordinator' => [[
                Faculty::find($department->phdCoordinators->first()->faculty_id)->user,
                'phd_coordinator',
            ]],
            'hod' => [[$department->hod->user, 'hod']],
            'adordc' => [[$department->adordc->user, 'adordc']],
            'dordc', 'dra' => [[$this->roleHolder($stage), $stage]],
            'director' => [[$this->director(), 'director']],
            default => throw new \RuntimeException("no one is set up to act on the {$stage} step"),
        };
    }

    private function submitStep(string $type, $form, User $user, string $role): void
    {
        [$controller] = self::FLOW[$type];
        [$data, $files] = $this->stepData($type, $role, $form);

        $acting = $this->actingAs($user, $role);
        $request = Request::create('/', 'POST', $data);
        foreach ($files as $field => $file) {
            $request->files->set($field, $file);
        }
        $request->setUserResolver(fn () => $acting);
        Auth::setUser($acting);

        $controller = app($controller);
        $response = $type === 'presentation'
            ? $controller->submit($request, $form->semester_id, $form->id)
            : $controller->submit($request, $form->id);

        $status = $response->getStatusCode();

        // 201 is not a failure: it is what a form says when one of several
        // approvers has signed and it is waiting on the rest.
        if ($status === 200 || $status === 201) {
            return;
        }

        $body = $response->getData(true);
        $message = $body['message'] ?? json_encode($body['errors'] ?? $body);
        throw new \RuntimeException("{$role} step refused ({$status}): {$message}");
    }

    /**
     * Record the outside expert's decision through the same token-authenticated
     * endpoint the emailed link points at, since there is no portal account to
     * act as here.
     */
    private function externalReview(IrbSubForm $form): void
    {
        $approval = Approval::where('model_type', IrbSubForm::class)
            ->where('model_id', $form->id)
            ->first();

        if (!$approval) {
            throw new \RuntimeException('the external review request was never created');
        }

        $request = Request::create('/', 'POST', [
            'decision' => 'recommend',
            'comment' => 'The revised objectives address the committee\'s concerns.',
        ]);

        $response = app(ExternalReviewController::class)->submit($request, $approval->key);
        if ($response->getStatusCode() !== 200) {
            throw new \RuntimeException('external review refused: ' . ($response->getData(true)['message'] ?? 'unknown'));
        }
    }

    /**
     * What each step is asked to fill in. Only the steps that collect something
     * are listed; every other step is a plain approval.
     */
    private function stepData(string $type, string $role, $form): array
    {
        $approve = ['approval' => 1, 'comments' => 'Approved.'];

        return match ("{$type}:{$role}") {
            'supervisor-allocation:student' => [[
                'prefrences' => $this->preferences(6),
                'broad_area_of_research' => ['Process modelling and simulation'],
            ], []],
            'supervisor-allocation:phd_coordinator' => [$approve + [
                'supervisors' => $this->supervisorCodes,
            ], []],

            'irb-constitution:student' => [[
                'title' => 'Modelling of transport phenomena in packed bed reactors',
                'objectives' => [
                    'Build a validated model of the packed bed reactor',
                    'Measure the effect of particle size on conversion',
                    'Compare the model against pilot plant data',
                ],
                'address' => 'Thapar Institute of Engineering and Technology, Patiala',
                'gender' => 'Male',
                'cgpa' => $this->student->cgpa ?: 8,
                'broad_area_of_research' => 'Reaction engineering',
                'subdomains' => ['Packed bed reactors', 'Transport phenomena'],
            ], ['irb_pdf' => $this->pdf('irb.pdf')]],
            'irb-constitution:faculty' => [$approve + [
                'nominee_cognates' => $this->cognateCodes,
            ], []],
            'irb-constitution:hod' => [$approve + [
                'chairman_experts' => [$this->chairmanCode],
                'outside_experts' => $this->outsideExpertIds,
            ], []],
            'irb-constitution:dordc' => [$approve + [
                'outside_expert' => $this->pickOutsideExpert($form),
                'cognate_expert' => $this->pickCognate($form),
            ], []],

            'irb-submission:student' => [[
                'revised_phd_title' => 'Modelling and experimental study of packed bed reactors',
                'revised_phd_objectives' => [
                    'Extend the reactor model to non-isothermal operation',
                    'Validate the extended model against pilot plant runs',
                ],
                'date_of_irb' => now()->subMonths(6)->toDateString(),
            ], ['irb_pdf' => $this->pdf('revised-irb.pdf')]],
            'irb-submission:faculty' => [$approve + ['supervised_outside' => 0], []],

            'presentation:student' => [[
                'teaching_work' => 'Both',
            ], ['presentation_pdf' => $this->pdf('presentation.pdf')]],
            'presentation:faculty' => [$approve + [
                'progress' => 20,
                'attendance' => 90,
                'contact_hours' => 8,
            ], []],

            'synopsis-submission:student' => [[
                'revised_title' => 'Modelling and experimental study of packed bed reactors',
            ], ['synopsis_pdf' => $this->pdf('synopsis.pdf')]],
            'synopsis-submission:faculty' => [$approve + ['current_progress' => 30], []],

            'thesis-submission:student' => [[
                'date_of_synopsis' => now()->subMonths(3)->toDateString(),
                'reciept_no' => 'DEMO/2026/0001',
                'date_of_fee_submission' => now()->subMonth()->toDateString(),
            ], [
                'thesis_pdf' => $this->pdf('thesis.pdf'),
                'fee_receipt' => $this->pdf('fee-receipt.pdf'),
            ]],

            'list-of-examiners:faculty' => [$approve + [
                'national' => $this->examiners('national'),
                'international' => $this->examiners('international'),
            ], []],
            'list-of-examiners:dordc' => [$approve + [
                'approvals' => ExaminersRecommendation::where('form_id', $form->id)->pluck('email')->all(),
                'rejections' => [],
            ], []],

            'status-change:student' => [[
                'reason' => 'Taking up a full time teaching post from the coming semester.',
            ], []],

            'semester-off:student' => [[
                'reason' => 'Away on medical leave for the semester.',
                'semester_off_required' => $this->latestSemesterCode(),
            ], ['proof_pdf' => $this->pdf('medical-proof.pdf')]],

            // No duration is sent, which is what the form itself does. The field is
            // optional, and the controller assigns it to a property the table has
            // no column for, so sending one is rejected outright.
            'irb-extension:student' => [[
                'reason' => 'The pilot plant runs need another six months to finish.',
            ], ['research_pdf' => $this->pdf('extension.pdf')]],

            'thesis-extension:student' => [[
                'reason' => 'Writing up is taking longer than planned.',
                'date_of_synopsis' => now()->subMonths(3)->toDateString(),
            ], []],

            'supervisor-change:student' => [[
                'reason' => 'The second supervisor is on sabbatical for the coming year.',
                'to_change' => [$this->supervisorCodes[1]],
                'prefrences' => $this->preferences(3),
            ], []],
            'supervisor-change:phd_coordinator' => [$approve + [
                'new_supervisors' => [$this->replacementCode],
            ], []],

            default => [$role === 'student' ? [] : $approve, []],
        };
    }

    /**
     * Give the student a publication and put it on every form that shows one.
     * Progress monitoring, the synopsis and the thesis each keep their own copy,
     * so all three are linked separately.
     */
    private function linkPublications(): void
    {
        $publication = $this->basePublication();

        foreach (self::LINKED_FORMS as $type => $formType) {
            [$controllerClass, $model] = self::FLOW[$type];

            $form = $model::where('student_id', $this->student->roll_no)->orderByDesc('id')->first();
            if (!$form) {
                continue;
            }

            // Form ids are only unique within a form type, so both have to match.
            $linked = Publication::where('form_id', $form->id)
                ->where('form_type', $formType)
                ->where('title', $publication->title)
                ->exists();

            if ($linked) {
                $this->line(sprintf('  %-22s publication already linked', $type));
                continue;
            }

            $request = Request::create('/', 'POST', [
                'publications' => [$publication->id],
                // Always sent, even empty: the controller counts it without
                // checking whether it is there.
                'patents' => [],
            ]);
            $student = $this->actingAs($this->studentUser, 'student');
            $request->setUserResolver(fn () => $student);
            Auth::setUser($student);

            $controller = app($controllerClass);
            $response = $type === 'presentation'
                ? $controller->linkPublication($request, $form->semester_id, $form->id)
                : $controller->linkPublication($request, $form->id);

            if ($response->getStatusCode() !== 200) {
                throw new \RuntimeException(
                    "could not link the publication to {$type}: " . ($response->getData(true)['message'] ?? 'unknown')
                );
            }

            $this->line(sprintf('  %-22s publication linked', $type));
        }
    }

    /**
     * The student's own publication, the row their publications page lists. Each
     * form links a copy of it rather than the row itself, so this one is created
     * once and left alone.
     */
    private function basePublication(): Publication
    {
        $existing = Publication::where('student_id', $this->student->roll_no)
            ->whereNull('form_id')
            ->where('title', self::PUBLICATION_TITLE)
            ->first();

        if ($existing) {
            return $existing;
        }

        $request = Request::create('/', 'POST', [
            'title' => self::PUBLICATION_TITLE,
            'publication_type' => 'journal',
            'authors' => $this->studentUser->name() . ', ' . Faculty::find($this->supervisorCodes[0])->user->name(),
            'status' => 'published',
            'doi_link' => 'https://doi.org/10.0000/demo.2026.00001',
            'year' => '2026',
            'name' => 'Journal of Demo Chemical Engineering',
            'impact_factor' => 2.4,
            'type' => 'sci',
            'volume' => '14',
            'page_no' => '101',
        ]);
        $request->files->set('first_page', $this->pdf('publication.pdf'));

        $student = $this->actingAs($this->studentUser, 'student');
        $request->setUserResolver(fn () => $student);
        Auth::setUser($student);

        $response = app(PublicationController::class)->store($request);
        if ($response->getStatusCode() >= 400) {
            $body = $response->getData(true);
            throw new \RuntimeException('could not add the publication: ' . ($body['message'] ?? json_encode($body['errors'] ?? $body)));
        }

        $this->line('  publication            added');

        return Publication::where('student_id', $this->student->roll_no)
            ->whereNull('form_id')
            ->where('title', self::PUBLICATION_TITLE)
            ->firstOrFail();
    }

    /** Faculty codes offered as choices, which only have to exist and be distinct. */
    private function preferences(int $count): array
    {
        $codes = Faculty::where('department_id', $this->student->department_id)
            ->orderBy('faculty_code')
            ->limit($count)
            ->pluck('faculty_code')
            ->all();

        if (count($codes) < $count) {
            $codes = Faculty::orderBy('faculty_code')->limit($count)->pluck('faculty_code')->all();
        }

        return $codes;
    }

    /** The four names each list needs before DoRDC will let the form through. */
    private function examiners(string $type): array
    {
        $examiners = [];
        foreach (range(1, 4) as $n) {
            $examiners[] = [
                'name' => 'Demo ' . ucfirst($type) . ' Examiner ' . $n,
                'email' => "demo.{$type}.{$n}@demo.invalid",
                'institution' => $type === 'national' ? 'Demo Institute of Technology' : 'Demo University Abroad',
                'designation' => 'Professor',
                'department' => 'Chemical Engineering',
                'phone' => '9999900' . str_pad((string) $n, 3, '0', STR_PAD_LEFT),
            ];
        }

        return $examiners;
    }

    /** DoRDC picks from the three the HOD put up, so read them back off the form. */
    private function pickOutsideExpert($form): int
    {
        return IrbOutsideExpert::where('irb_form_id', $form->id)->value('expert_id');
    }

    private function pickCognate($form): int
    {
        return IrbNomineeCognate::where('irb_form_id', $form->id)->value('nominee_id');
    }

    private function latestSemesterCode(): string
    {
        $semester = Semester::orderByDesc('year')->orderByDesc('semester')->first();
        if (!$semester) {
            throw new \RuntimeException('there are no semesters set up to take off');
        }

        return $semester->semester_name;
    }

    /**
     * Set the role a user is acting in without touching the stored one. The
     * controllers read current_role as a relation, so overriding it in memory is
     * enough, and the real account keeps whichever role it was last using.
     */
    private function actingAs(User $user, string $role): User
    {
        $acting = clone $user;
        $acting->setRelation('current_role', Role::where('role', $role)->firstOrFail());

        return $acting;
    }

    /**
     * The director account, created if it is not there yet.
     *
     * Named rather than picked from whoever happens to hold the role, so the same
     * account signs every run. Nothing is emailed: the account is written through
     * Eloquent rather than the admin screens, which notify a new user of their
     * credentials, and first_activation is set so the first login does not stop
     * to ask for a new password.
     */
    private function director(): ?User
    {
        if ($this->directorUser) {
            return $this->directorUser;
        }

        $email = $this->option('director');
        $roleId = Role::where('role', 'director')->value('id');

        if (!$roleId) {
            $this->error('The roles table has no director row. Seed roles before running this.');
            return null;
        }

        $existing = User::where('email', $email)->first();
        if ($existing) {
            if ($existing->role_id != $roleId) {
                $this->error("{$email} already exists but is not a director. Pass --director with another address.");
                return null;
            }

            return $this->directorUser = $existing;
        }

        $password = $this->option('password');
        $this->directorUser = User::create([
            'first_name' => 'Director',
            'last_name' => 'Office',
            'email' => $email,
            'password' => Hash::make($password),
            'role_id' => $roleId,
            'current_role_id' => $roleId,
            'default_role_id' => $roleId,
            // Both are strings in this schema, not booleans.
            'first_activation' => 'false',
            'status' => 'active',
            'available_roles' => ['director'],
            'email_verified_at' => now(),
        ]);

        $this->newLine();
        $this->warn("No director account existed, so one was created: {$email} / {$password}");
        $this->newLine();

        return $this->directorUser;
    }

    private function roleHolder(string $role): ?User
    {
        $roleId = Role::where('role', $role)->value('id');

        return $roleId ? User::where('role_id', $roleId)->orderBy('id')->first() : null;
    }

    private function pdf(string $name): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'demoform');
        file_put_contents($path, self::PDF);

        // The last argument marks the file as a test upload, which is what lets a
        // file that never came through a browser be validated and stored.
        return new UploadedFile($path, $name, 'application/pdf', null, true);
    }

    private function showStatus(): int
    {
        $rows = [];
        foreach (self::FLOW as $type => [, $model]) {
            $form = $model::where('student_id', $this->student->roll_no)->orderByDesc('id')->first();
            $rows[] = [
                $type,
                $form ? $form->id : '-',
                $form ? $form->completion : 'not started',
                $form ? $form->stage : '-',
                $form ? ($form->status ?? '-') : '-',
            ];
        }

        $this->newLine();
        $this->table(['Form', 'Id', 'Completion', 'Stage', 'Status'], $rows);

        $supervisors = $this->student->supervisors()->get()
            ->map(fn ($faculty) => $faculty->user->email . ' (' . $faculty->faculty_code . ')')
            ->join(', ');
        $this->line('  supervising now: ' . ($supervisors ?: 'nobody'));

        return self::SUCCESS;
    }
}
