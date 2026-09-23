<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\NotificationManager;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\AppSetting;
use App\Models\Faculty;
use App\Models\UgBranch;
use App\Models\UgStudent;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\UrfApplication;
use App\Models\UrfFellow;
use App\Models\UrfReport;
use App\Models\UrfReportWindow;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The Undergraduate Research Fellowship: a UG student applies while the window
 * is open, gives their stipend details once selected, and files reports.
 */
class UrfController extends Controller
{
    use FilterLogicTrait;
    use NotificationManager;
    use SaveFile;

    private const SEARCH_KEYS = ['status'];

    private const FORM_NAMES = [
        'urf-application' => 'URF Application Form',
        'urf-additional-info' => 'Additional Information Form',
        'urf-half-yearly-report' => 'Half-yearly Progress Report',
        'urf-final-report' => 'Final Report',
    ];

    /** How a recorded decision reads back on the form's history. */
    private const DECISION_WORDS = [
        'approve' => 'Recommended',
        'send_back' => 'Sent back to the student',
        'reject' => 'Rejected',
        'submitted' => 'Submitted',
        'selected' => 'Project selected by the office',
        'rejected' => 'Project rejected by the office',
    ];

    private const STEP_NAMES = [
        'student' => 'the student',
        'mentor' => 'the faculty mentor',
        'adordc' => 'the ADORDC',
        'dordc' => 'the DORDC',
        'office' => 'the office',
    ];

    private const DETAIL = [
        'student1Branch', 'student2Branch',
        'mentor1.user', 'mentor1.department', 'mentor2.user', 'mentor2.department',
        'fellows', 'reports',
    ];

    public function listFilters()
    {
        return response()->json($this->getAvailableFilters('urf'));
    }

    public function list(Request $request)
    {
        $user = Auth::user();
        if (!$this->mayRead($user)) {
            return $this->refuse();
        }

        $query = UrfApplication::with([
            'student1Branch', 'student2Branch',
            'mentor1.user', 'mentor1.department:id,code', 'mentor2.user', 'mentor2.department:id,code',
        ])
            ->orderByDesc('session')
            ->latest('id');

        if (!$user->may('can_manage_urf')) {
            $query->mentoredBy($user->faculty?->faculty_code);
        }
        $filters = json_decode((string) $request->query('filters'), true);
        if ($filters) {
            $query = $this->applyDynamicFilters($query, $filters, 'urf', self::SEARCH_KEYS);
        }
        $page = $query->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        return response()->json([
            'data' => $page->getCollection()->map(fn (UrfApplication $a) => [
                'id' => $a->id,
                'session' => $a->session,
                'project_title' => $a->project_title,
                'students' => collect([$a->student1_name, $a->student2_name])->filter()->join(', '),
                // Two students of the same branch and year say it once.
                'branch' => collect([
                    [$a->student1Branch?->name, $a->student1_year],
                    [$a->student2Branch?->name, $a->student2_year],
                ])->map(fn ($pair) => collect([$pair[0], UrfApplication::yearLabel($pair[1])])->filter()->join(', '))
                    ->filter()->unique()->join(' · '),
                'mentors' => collect([$a->mentor1, $a->mentor2])->filter()
                    ->map(fn ($m) => collect([$m->user?->name(), $m->department?->code])->filter()->join(' · '))
                    ->join(', '),
                'mentor_list' => collect([$a->mentor1, $a->mentor2])->filter()->map(fn ($m) => [
                    'code' => $m->faculty_code,
                    'name' => $m->user?->name(),
                    'department' => $m->department?->code,
                ])->values(),
                'status' => ucfirst($a->status),
                // Where it has reached, which is not whether the project is on.
                // A complete form waits on nobody, and was not always approved.
                'stage' => $a->isComplete() ? null : 'With ' . ucfirst($a->stage),
                'applied_on' => $this->submittedOn($a)?->format('d M Y'),
                // Not a column of its own: the title opens it.
                'proposal' => $a->proposal,
            ]),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => ['session', 'project_title', 'students', 'branch', 'mentors', 'stage', 'status', 'applied_on'],
            'fieldsTitles' => ['Session', 'Project Title', 'Students', 'Branch and Year', 'Mentors', 'Waiting On', 'Status', 'Applied On'],
        ]);
    }

    /** One form's submissions, each row carrying the project it belongs to. */
    public function formList(Request $request, string $form)
    {
        if ($form === 'urf-application') {
            return $this->list($request);
        }
        $user = Auth::user();
        if (!$this->mayRead($user)) {
            return $this->refuse();
        }

        $filters = json_decode((string) $request->query('filters'), true);
        $details = $form === 'urf-additional-info';
        $page = ($details ? UrfFellow::query() : UrfReport::where('type', $form === 'urf-final-report' ? 'final' : 'half_yearly'))
            ->with(['application.student1Branch', 'application.student2Branch', 'user'])
            ->unless($user->may('can_manage_urf'), fn ($q) => $q->whereHas(
                'application',
                fn ($a) => $a->mentoredBy($user->faculty?->faculty_code)
            ))
            ->when($filters, fn ($q) => $q->whereHas('application', fn ($a) => $this->applyDynamicFilters($a, $filters, 'urf', self::SEARCH_KEYS)))
            ->latest('id')
            ->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        // The row's student, found on the application by their email.
        $student = function ($row) {
            $n = $row->application->slotOf($row->user);
            return [
                'branch' => collect([
                    $row->application->{"student{$n}Branch"}?->name,
                    UrfApplication::yearLabel($row->application->{"student{$n}_year"}),
                ])->filter()->join(', '),
            ];
        };
        $common = fn ($row) => [
            'id' => $row->id,
            'application_id' => $row->urf_application_id,
            'session' => $row->application->session,
            'project_title' => $row->application->project_title,
            'submitted_on' => $this->submittedOn($row, true)?->format('d M Y'),
        ];

        return response()->json([
            'data' => $page->getCollection()->map(fn ($row) => $common($row) + $student($row) + ($details ? [
                'student' => $row->full_name,
                // Only a selected project has stipend details, so its status said
                // nothing; where the form itself stands does.
                'stage' => $row->isComplete() ? null : 'With ' . ucfirst($row->stage),
            ] : [
                'submitted_by' => $row->user->name(),
                'conference_presentation' => $row->conference_presentation,
                'report' => $row->report,
            ])),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => $details
                ? ['session', 'student', 'branch', 'project_title', 'stage', 'submitted_on']
                : ['session', 'project_title', 'submitted_by', 'branch', 'conference_presentation', 'submitted_on', 'report'],
            'fieldsTitles' => $details
                ? ['Session', 'Student', 'Branch and Year', 'Project Title', 'Waiting On', 'Submitted On']
                : ['Session', 'Project Title', 'Submitted By', 'Branch and Year', 'Conference Presentation', 'Submitted On', 'Report'],
        ]);
    }

    /**
     * One form of one project, in the shape the PhD form pages read: the chain
     * it is on, where it has reached, what each step said, and what was filled
     * in. The client draws it with the same title bar, status view and ladder.
     */
    public function formShow(string $form, $id)
    {
        $user = Auth::user();
        $instance = $this->formRow($form, $id);
        $application = $instance->approvalApplication();
        if (!$application) {
            return $this->refuse();
        }

        // The office reads every form. Everyone else has to be a step on this
        // one: a student of the project, its mentor, the ADORDC of their
        // branch's department, or the DORDC.
        $step = $instance->stepFor($user);
        $office = $user->may('can_manage_urf');
        if (!$office && !$step) {
            return $this->refuse();
        }

        $steps = array_merge(UrfApplication::CHAIN, [UrfApplication::COMPLETE]);
        $reached = array_search($instance->stage, $steps, true);
        // A step is answered once the form has moved past it. Sending a form
        // back puts it on the student again and clears what the approvers said,
        // so the position alone is the truth here.
        //
        // Not on a closed form, though: the office's decision or an import
        // closes it wherever it stood. There the approvers heard from since the
        // last filing are the ones who answered, and the rest were never reached.
        $heard = null;
        if ($instance->isComplete() && !empty($instance->history)) {
            $history = collect($instance->history)->values();
            $lastFiling = $history->keys()->filter(fn ($i) => ($history[$i]['decision'] ?? null) === 'submitted')->last() ?? -1;
            $heard = $history->slice($lastFiling + 1)->pluck('step')->intersect(UrfApplication::APPROVERS)->all();
        }
        $answered = fn (string $one) => $heard !== null && in_array($one, UrfApplication::APPROVERS, true)
            ? in_array($one, $heard, true)
            : $reached > array_search($one, $steps, true);

        $said = fn (string $key) => collect(UrfApplication::APPROVERS)
            ->mapWithKeys(fn ($approver) => [$approver => $instance->{$approver . '_' . $key}])
            ->all();

        return response()->json([
            'form' => $form,
            'form_id' => $instance->id,
            'form_name' => self::FORM_NAMES[$form],
            'application_id' => $application->id,
            'project_title' => $application->project_title,
            'session' => $application->session,
            'status' => $application->status,
            'stage' => $instance->stage,
            'steps' => $steps,
            'current_step' => $reached === false ? 0 : $reached,
            // How far the approvers got on a closed form, so the ladder shows
            // the steps after it as not reached. Null leaves every step reached.
            'maximum_step' => $heard === null ? null
                : collect($heard)->map(fn ($one) => array_search($one, $steps, true))->push(0)->max(),
            // FormLadder shows every step to "admin" and the steps up to their
            // own to anyone else. The office holds no step on the chain, so it
            // reads the form the way an admin reads a PhD one.
            'role' => $office ? 'admin' : $step,
            'comments' => ['student' => null] + $said('comments'),
            // Booleans, as the PhD forms answer them: the column is an int
            // here, and the radios read a 0 as an answer already given. A step
            // that never answered has no answer to give.
            'approvals' => collect($said('approval'))
                ->map(fn ($approval, $one) => $answered($one) ? (bool) $approval : null)->all(),
            'locks' => collect($steps)->mapWithKeys(fn ($one) => [$one => $answered($one)])->all(),
            'history' => $this->historyOf($instance),
            'awaiting_me' => $instance->awaits($user),
            // Rejecting ends the project, which is the DORDC's alone and only
            // on the application itself.
            'may_reject' => $instance->awaits($user) && $step === 'dordc' && $instance instanceof UrfApplication,
            'filled' => $this->filledIn($form, $instance, $application, $office),
            'application' => $this->payload($application->load(self::DETAIL), $user),
        ]);
    }

    private function formRow(string $form, $id)
    {
        return match ($form) {
            'urf-application' => UrfApplication::findOrFail($id),
            'urf-additional-info' => UrfFellow::with('user')->findOrFail($id),
            default => UrfReport::with('user')->findOrFail($id),
        };
    }

    /** What the history reads as on the page, one line per decision taken. */
    private function historyOf($instance): array
    {
        return collect($instance->history ?? [])->map(fn ($entry) => [
            'timestamp' => $entry['at'] ?? null,
            'action' => trim((self::DECISION_WORDS[$entry['decision'] ?? ''] ?? ucfirst((string) ($entry['decision'] ?? 'Answered')))
                . ' by ' . ($entry['by'] ?? 'someone')
                . (isset(self::STEP_NAMES[$entry['step'] ?? '']) ? ' (' . self::STEP_NAMES[$entry['step']] . ')' : '')),
            'comment' => $entry['comments'] ?? null,
        ])->values()->all();
    }

    /**
     * The form's own answers. The application draws itself from the project
     * payload, which already carries the team and the proposal; the other two
     * are rows of their own.
     *
     * A fellow's PAN, Aadhaar and bank account go to the office and to the
     * student who gave them. An approver is checking that the person is who
     * they say, not their bank, so they read the last four digits.
     */
    private function filledIn(string $form, $instance, UrfApplication $application, bool $office): ?array
    {
        if ($form === 'urf-application') {
            return null;
        }

        $row = $instance->toArray();
        $row['submitted_by'] = $instance->user?->name();
        $row['submitted_on'] = $this->submittedOn($instance, true)?->toIso8601String();

        if ($form === 'urf-additional-info') {
            $mine = $instance->user_id === Auth::id();
            foreach (['pan', 'aadhaar', 'account_no'] as $secret) {
                if (!$office && !$mine) {
                    $row[$secret] = $this->lastFour($instance->{$secret});
                }
            }

            return $row;
        }

        $row['publications'] = Publication::groupedFor('urf_application_id', $application->id, $instance->id, 'urf_report');

        return $row;
    }

    /**
     * When the student filed the form, from its history: the row's own date is
     * the import's for a project carried over, which nobody filed here. The
     * first filing, or with $latest the last one after a send back. Null when
     * it was never filed in the portal.
     */
    private function submittedOn($instance, bool $latest = false): ?\Illuminate\Support\Carbon
    {
        $filed = collect($instance->history ?? [])->where('decision', 'submitted');
        $entry = $latest ? $filed->last() : $filed->first();

        return isset($entry['at']) ? \Illuminate\Support\Carbon::parse($entry['at']) : null;
    }

    private function lastFour(?string $value): string
    {
        $value = (string) $value;

        return $value === '' ? '' : str_repeat('X', max(strlen($value) - 4, 0)) . substr($value, -4);
    }

    public function show($id)
    {
        $user = Auth::user();
        if (!$this->mayRead($user)) {
            return $this->refuse();
        }

        $application = UrfApplication::with(self::DETAIL)->findOrFail($id);
        if (!$user->may('can_manage_urf') && !$this->mentors($user, $application)) {
            return $this->refuse();
        }

        return response()->json($this->payload($application, $user));
    }

    /** Public: a student picking their branch at sign-up has no account yet. */
    public function branches()
    {
        return response()->json(UgBranch::ordered()->get(['id', 'programme', 'code', 'name']));
    }

    /** The sessions that have projects, for the year picker. */
    public function sessions()
    {
        $user = Auth::user();
        if (!$this->mayRead($user)) {
            return $this->refuse();
        }

        return response()->json(
            UrfApplication::query()
                ->unless($user->may('can_manage_urf'), fn ($q) => $q->mentoredBy($user->faculty?->faculty_code))
                ->distinct()->orderByDesc('session')->pluck('session')->values()
        );
    }

    private static function roundName(string $type): string
    {
        return self::FORM_NAMES[$type === 'final' ? 'urf-final-report' : 'urf-half-yearly-report'];
    }

    public function reportWindows()
    {
        if (!$this->mayRead(Auth::user())) {
            return $this->refuse();
        }

        return response()->json(UrfReportWindow::orderByDesc('session')->orderBy('type')->get());
    }

    /** One round per session per report, so scheduling it twice moves its dates. */
    public function saveReportWindow(Request $request)
    {
        if (!Auth::user()->may('can_manage_urf')) {
            return $this->refuse();
        }

        $data = $request->validate([
            'session' => 'required|integer|min:2000',
            'type' => 'required|in:half_yearly,final',
            'opens_on' => 'required|date',
            'closes_on' => 'required|date|after_or_equal:opens_on',
            'notes' => 'nullable|string|max:255',
        ]);

        $window = UrfReportWindow::for($data['session'], $data['type'])->first() ?? new UrfReportWindow();

        // A round that is running has fellows filing to its dates, so the day
        // it opened is settled while it runs and only the day it closes can
        // move, as a semester keeps its start. A round already closed is free
        // again: nobody is filing to it, and moving it is how the office runs
        // that round a second time.
        if ($window->exists && $window->is_open && $data['opens_on'] !== $window->opens_on->toDateString()) {
            return response()->json([
                'message' => 'This round is open, and opened on ' . $window->opens_on->format('d M Y')
                    . '. A round keeps its opening day while it runs; move the day it closes instead.',
            ], 422);
        }

        // One round runs at a time, so a fellow is never asked for two reports
        // at once. Checked across every session and not only this one: a
        // session is a calendar year and its rounds run inside it, so last
        // year's final can reach into this year's first round.
        $clash = UrfReportWindow::query()
            ->when($window->exists, fn ($query) => $query->whereKeyNot($window->getKey()))
            ->where('opens_on', '<=', $data['closes_on'])
            ->where('closes_on', '>=', $data['opens_on'])
            ->orderBy('opens_on')
            ->first();

        if ($clash) {
            return response()->json([
                'message' => 'One round runs at a time, and that overlaps the ' . self::roundName($clash->type)
                    . ' round for URF ' . $clash->session . ', which runs '
                    . $clash->opens_on->format('d M Y') . ' to ' . $clash->closes_on->format('d M Y') . '.',
            ], 422);
        }

        $window->fill($data)->save();
        // A round that opens today is announced now rather than at tomorrow's run.
        Artisan::call('urf:announce-report-rounds');

        return response()->json($window, 201);
    }

    /** Reports already filed stay where they are. */
    public function deleteReportWindow($id)
    {
        if (!Auth::user()->may('can_manage_urf')) {
            return $this->refuse();
        }

        UrfReportWindow::findOrFail($id)->delete();

        return response()->json(['message' => 'Round removed']);
    }

    /** Every project the student is on, and whether applications are open. */
    public function mine()
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_urf')) {
            return $this->refuse();
        }

        return response()->json([
            'applications_open' => (bool) AppSetting::value('urf', 'applications_open'),
            'session' => (int) now()->year,
            // What they gave at sign-up. Absent for an account the office made,
            // and then the application form asks for it.
            'student' => $user->ugStudent()->with('branch:id,programme,code,name')->first(),
            // The account as it stands now, not as it was at sign-in.
            'account' => $user->only(['email', 'phone', 'gender']),
            'report_windows' => UrfReportWindow::orderByDesc('session')->get(),
            'applications' => UrfApplication::forMember($user)->with(self::DETAIL)->orderByDesc('session')->latest('id')->get()
                ->map(fn (UrfApplication $application) => $this->payload($application, $user))
                ->values(),
        ]);
    }

    /** A rejected application leaves the student free to apply afresh. */
    public function apply(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_urf')) {
            return $this->refuse();
        }
        // One application per student per session, the calendar year.
        $session = (int) now()->year;
        $application = UrfApplication::forMember($user)
            ->where('session', $session)
            ->where('status', '!=', 'rejected')
            ->latest('id')
            ->first();
        if ($application?->status === 'selected') {
            return response()->json(['message' => "You already have a URF project for {$session}"], 422);
        }
        $editing = $application?->status === 'applied';

        // Closing applications stops new ones. A correction is of a form
        // already filed, which a step sent back to be fixed, so closing the
        // window in the meantime must not strand it on the student with no way
        // to return it. The stage check below is what keeps this to a form
        // actually sent back.
        if (!$editing && !AppSetting::value('urf', 'applications_open')) {
            return response()->json(['message' => 'URF applications are closed'], 422);
        }
        if ($editing && $application->user_id !== $user->id) {
            return response()->json(['message' => 'Only the student who applied can change the application'], 403);
        }
        // A filed application is being read by the chain. It is corrected only
        // once a step sends it back, which puts it on the student again.
        if ($editing && $application->stage !== 'student') {
            return response()->json(['message' => 'This application has been submitted. You can change it only if a reviewer sends it back to you.'], 422);
        }

        $second = 'required_with:student2_name|nullable';
        // Mentors are institute faculty, not outside members of the directory.
        $internalFaculty = Rule::exists('faculty', 'faculty_code')->where('type', 'internal');
        $data = $request->validate([
            'project_title' => 'required|string|max:255',
            'student1_name' => 'required|string|max:255',
            'student1_roll_no' => 'required|string|max:50',
            'student1_branch_id' => 'required|exists:ug_branches,id',
            'student1_year' => 'required|integer|between:1,4',
            'student1_gender' => 'required|in:Male,Female',
            'student1_email' => 'required|email',
            'student1_phone' => 'required|string|max:20',
            'student2_name' => 'nullable|string|max:255',
            'student2_roll_no' => "$second|string|max:50",
            'student2_branch_id' => "$second|exists:ug_branches,id",
            'student2_year' => "$second|integer|between:1,4",
            'student2_gender' => "$second|in:Male,Female",
            'student2_email' => "$second|email|different:student1_email",
            'student2_phone' => "$second|string|max:20",
            'mentor1_faculty_code' => ['required', $internalFaculty],
            'mentor2_faculty_code' => ['nullable', 'different:mentor1_faculty_code', $internalFaculty],
            'proposal' => ($editing ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480',
        ]);

        // The applicant was checked above; the second student has to be free
        // too, or one student ends up on two projects in the same session.
        if (!empty($data['student2_email'])) {
            $email = $data['student2_email'];
            $partnerId = User::where('email', $email)->value('id');
            $taken = UrfApplication::where('session', $session)
                ->where('status', '!=', 'rejected')
                ->when($editing, fn ($query) => $query->whereKeyNot($application->id))
                ->where(fn ($query) => $query->where('student2_email', $email)
                    ->when($partnerId, fn ($query) => $query->orWhere('user_id', $partnerId)))
                ->exists();
            if ($taken) {
                return response()->json([
                    'message' => "{$data['student2_name']} is already on a URF application for {$session}.",
                    'errors' => ['student2_email' => ["This student is already on a URF application for {$session}."]],
                ], 422);
            }
        }

        // Roll number and branch come from the account, not the form, so they
        // cannot drift between applications.
        if ($record = $user->ugStudent) {
            $data['student1_roll_no'] = $record->roll_no;
            $data['student1_branch_id'] = $record->branch_id;
            if ((int) $data['student1_year'] !== (int) $record->year) {
                $record->update(['year' => $data['student1_year']]);
            }
        }

        if (!$editing) {
            $application = new UrfApplication();
            $application->user_id = $user->id;
            $application->session = $session;
        }
        // Every field is written, so clearing the second student sticks.
        $application->fill(array_merge(array_fill_keys($application->getFillable(), null), $data));
        if ($request->hasFile('proposal')) {
            $application->proposal = $this->replaceUploadedFile(
                $editing ? $application->proposal : null, $request->file('proposal'), 'urf_proposal', $user->id
            );
        }
        $application->save();
        // Filed or corrected, the reading starts again at the mentor.
        $application->backToTheStartOfTheChain($user);
        $this->commitFileDeletions();

        return response()->json($application, $editing ? 200 : 201);
    }

    /**
     * Onboard projects that were awarded before the portal, from the office's
     * own sheet.
     *
     * These were not decided here, so nothing pretends they were: the
     * application is created already selected, and the chain is closed by the
     * office with a history entry saying where the decision came from. Writing
     * mentor and ADORDC approvals would be recording readings nobody did.
     *
     * A project is matched on the first student's email and the session, so the
     * same file twice updates rather than duplicates.
     */
    public function importAwarded(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $rows = $request->validate(['rows' => 'required|array|min:1'])['rows'];
        $branches = UgBranch::all();

        $added = 0;
        $updated = 0;
        $errors = [];

        foreach ($rows as $index => $row) {
            $line = $row['_rowNumber'] ?? $index + 2;
            $cell = fn (string $key) => trim((string) ($row[$key] ?? ''));

            $title = $cell('project_title');
            $mentorEmail = $cell('mentor1_email');
            if ($title === '' || $cell('student1_email') === '' || $mentorEmail === '') {
                $errors[] = "Row {$line}: a project title, the first student's email and the mentor's email are all needed.";
                continue;
            }

            // A project with no mentor has nobody to approve its reports, so an
            // unknown mentor names the row rather than importing half a project.
            $mentor = $this->internalFacultyByEmail($mentorEmail);
            if (!$mentor) {
                $errors[] = "Row {$line}: no internal faculty member has the email {$mentorEmail}.";
                continue;
            }

            $secondMentor = null;
            if ($cell('mentor2_email') !== '') {
                $secondMentor = $this->internalFacultyByEmail($cell('mentor2_email'));
                if (!$secondMentor) {
                    $errors[] = "Row {$line}: no internal faculty member has the email " . $cell('mentor2_email') . ".";
                    continue;
                }
            }

            try {
                $students = [];
                foreach ([1, 2] as $slot) {
                    if ($cell("student{$slot}_email") === '') {
                        continue;
                    }
                    $students[$slot] = $this->awardedStudent($row, $slot, $branches, $line);
                }
            } catch (\RuntimeException $e) {
                $errors[] = $e->getMessage();
                continue;
            }

            $session = (int) ($cell('session') ?: now()->year);
            $application = UrfApplication::where('student1_email', $cell('student1_email'))
                ->where('session', $session)->first();
            $existed = (bool) $application;

            $application = $application ?: new UrfApplication();
            $application->user_id = $students[1]['account']->id;
            $application->session = $session;
            $application->project_title = $title;
            $application->mentor1_faculty_code = $mentor->faculty_code;
            $application->mentor2_faculty_code = $secondMentor?->faculty_code;
            $application->status = 'selected';

            foreach ([1, 2] as $slot) {
                $student = $students[$slot] ?? null;
                $application->fill([
                    "student{$slot}_name" => $student ? $student['name'] : null,
                    "student{$slot}_roll_no" => $student ? $student['roll_no'] : null,
                    "student{$slot}_branch_id" => $student ? $student['branch_id'] : null,
                    "student{$slot}_year" => $student ? $student['year'] : null,
                    "student{$slot}_gender" => $student ? $student['gender'] : null,
                    "student{$slot}_email" => $student ? $student['email'] : null,
                    "student{$slot}_phone" => $student ? $student['phone'] : null,
                ]);
            }
            $application->save();

            $application->closeChain($user, 'selected', 'Carried over from the awarded projects sheet.');

            $existed ? $updated++ : $added++;
        }

        return response()->json([
            'added' => $added,
            'updated' => $updated,
            'errors' => $errors,
        ]);
    }

    /** A mentor is institute faculty, not an outside member of the directory. */
    private function internalFacultyByEmail(string $email): ?Faculty
    {
        return Faculty::whereHas('user', fn ($query) => $query->where('email', $email))
            ->where('type', 'internal')
            ->first();
    }

    /**
     * The account and record for one student on an awarded row, made if they
     * have none.
     *
     * The branch comes from their own record where they already have one, so a
     * sheet naming a department rather than a branch still imports. Only a
     * student the portal has never seen has to be given a branch code, because
     * a department maps to several branches and guessing which is not something
     * an import should do.
     */
    private function awardedStudent(array $row, int $slot, $branches, $line): array
    {
        $cell = fn (string $key) => trim((string) ($row[$key] ?? ''));
        $email = $cell("student{$slot}_email");
        $name = $cell("student{$slot}_name");
        $rollNo = $cell("student{$slot}_roll_no");

        if ($name === '' || $rollNo === '') {
            throw new \RuntimeException("Row {$line}: student {$slot} needs a name and a roll number.");
        }

        $account = User::where('email', $email)->first();
        $branchId = $account?->ugStudent?->branch_id;

        if (!$branchId) {
            $code = $cell("student{$slot}_branch_code");
            $branch = $branches->first(fn (UgBranch $b) => strcasecmp($b->code, $code) === 0);
            if (!$branch) {
                throw new \RuntimeException(
                    "Row {$line}: {$email} is not on the portal yet, so the row needs a branch code for them"
                    . ($code === '' ? "." : ", and '{$code}' is not one.")
                );
            }
            $branchId = $branch->id;
        }

        $year = (int) ($cell("student{$slot}_year") ?: $account?->ugStudent?->year ?: 0);
        $gender = $cell("student{$slot}_gender");

        $parts = preg_split('/\s+/', $name, 2);
        $details = [
            'first_name' => $parts[0],
            'last_name' => $parts[1] ?? '',
            'email' => $email,
            'phone' => $cell("student{$slot}_phone") ?: null,
            'gender' => in_array($gender, ['Male', 'Female'], true) ? $gender : null,
        ];

        $account = DB::transaction(function () use ($details, $account, $rollNo, $branchId, $year) {
            if ($account) {
                $account->fill(array_filter($details))->save();
            } else {
                $account = UgStudent::registerAccount($details, null, true);
            }

            $record = $account->ugStudent ?: $account->ugStudent()->make();
            $record->fill(array_filter([
                'roll_no' => $rollNo,
                'branch_id' => $branchId,
                'year' => $year ?: null,
            ]));
            $account->ugStudent()->save($record);

            return $account->fresh();
        });

        return [
            'account' => $account,
            'name' => $name,
            'roll_no' => $rollNo,
            'branch_id' => $branchId,
            'year' => $year ?: null,
            'gender' => $details['gender'],
            'email' => $email,
            'phone' => $details['phone'],
        ];
    }

    /** The stipend details, one set per selected student. */
    public function saveFellow(Request $request, $id)
    {
        $user = Auth::user();
        $application = UrfApplication::findOrFail($id);
        if (!$user->may('can_apply_for_urf') || !$application->hasMember($user)) {
            return $this->refuse();
        }
        if ($application->status !== 'selected') {
            return response()->json(['message' => 'These details are asked for once the project is selected'], 422);
        }

        $keys = ['urf_application_id' => $application->id, 'user_id' => $user->id];
        $fellow = UrfFellow::where($keys)->first();
        // Submitted details are with the chain. Overwriting them here used to
        // rewrite an approved form and send it back round without anybody
        // asking, so they are changed only after a step sends the form back.
        if ($fellow && $fellow->stage !== 'student') {
            return response()->json(['message' => 'These details have been submitted. You can change them only if a reviewer sends the form back to you.'], 422);
        }

        $request->merge([
            'pan' => strtoupper(trim((string) $request->pan)),
            'ifsc' => strtoupper(trim((string) $request->ifsc)),
            'aadhaar' => preg_replace('/\s+/', '', (string) $request->aadhaar),
            'account_no' => preg_replace('/\s+/', '', (string) $request->account_no),
        ]);
        $data = $request->validate([
            'full_name' => 'required|string|max:255',
            'dob' => 'required|date|before:today',
            'gender' => 'required|in:Male,Female',
            'father_name' => 'required|string|max:255',
            'pan' => ['required', 'regex:/^[A-Z]{5}[0-9]{4}[A-Z]$/'],
            'aadhaar' => ['required', 'regex:/^\d{12}$/'],
            'bank_name' => 'required|string|max:255',
            'account_no' => ['required', 'regex:/^\d{9,18}$/'],
            'ifsc' => ['required', 'regex:/^[A-Z]{4}0[A-Z0-9]{6}$/'],
        ]);

        $fellow = $fellow ?? (new UrfFellow())->forceFill($keys);
        $fellow->fill($data)->save();
        $fellow->backToTheStartOfTheChain($user);

        return response()->json($fellow);
    }

    /** A half-yearly progress report or the final report. */
    public function addReport(Request $request, $id)
    {
        $user = Auth::user();
        $application = UrfApplication::findOrFail($id);
        if (!$user->may('can_apply_for_urf') || !$application->hasMember($user)) {
            return $this->refuse();
        }
        if ($application->status !== 'selected') {
            return response()->json(['message' => 'Reports are filed once the project is selected'], 422);
        }

        $data = $request->validate([
            'type' => 'required|in:half_yearly,final',
            'conference_presentation' => 'nullable|string|max:2000',
            'report' => 'required|file|mimes:pdf|max:20480',
        ]);

        $window = UrfReportWindow::for((int) $application->session, $data['type'])->first();
        if (!$window || !$window->is_open) {
            return response()->json([
                'message' => $window
                    ? 'This report was due between ' . $window->opens_on->format('d M Y') . ' and ' . $window->closes_on->format('d M Y') . '.'
                    : 'This report has not been scheduled yet.',
            ], 422);
        }
        // One report per project per round, filed by either student. A report
        // already with the chain is replaced only after a step sends it back:
        // without this a second submit slipped past the stage-scoped lookup
        // below and filed a duplicate instead. Latest first, for projects that
        // filed one per student before reports were per project.
        $existing = UrfReport::where('urf_application_id', $application->id)
            ->where('type', $data['type'])
            ->latest('id')
            ->first();
        if ($existing && $existing->stage !== 'student') {
            return response()->json(['message' => 'This report has been submitted. You can change it only if a reviewer sends it back to you.'], 422);
        }

        $chosen = fn ($value) => is_array($value) ? $value : (json_decode((string) $value, true) ?: []);
        $linked = ['publications' => $chosen($request->input('publications')), 'patents' => $chosen($request->input('patents'))];
        $data['report'] = $this->saveUploadedFile($request->file('report'), 'urf_report', $user->id);

        $report = DB::transaction(function () use ($data, $application, $user, $linked) {
            // A report sent back is replaced rather than filed twice, and is
            // recorded against whichever student filed it last.
            $report = UrfReport::where('urf_application_id', $application->id)
                ->where('type', $data['type'])
                ->where('stage', 'student')
                ->latest('id')
                ->first() ?? (new UrfReport())->forceFill(['urf_application_id' => $application->id]);
            $report->forceFill(['user_id' => $user->id])->fill($data);
            $report->save();

            // As a PhD progress form links them: a copy of each chosen entry,
            // tagged with this report. The library entry stays for later ones.
            foreach (['publications' => Publication::class, 'patents' => Patent::class] as $key => $model) {
                $model::whereIn('id', $linked[$key])
                    ->where('user_id', $user->id)
                    ->whereNull('form_id')
                    ->get()
                    ->each(fn ($entry) => $entry->replicate()->forceFill([
                        'form_id' => $report->id,
                        'form_type' => 'urf_report',
                        'urf_application_id' => $application->id,
                    ])->save());
            }

            return $report;
        });

        $report->backToTheStartOfTheChain($user);

        return response()->json($report, 201);
    }

    public function setStatus(Request $request, $id)
    {
        if (!Auth::user()->may('can_manage_urf')) {
            return $this->refuse();
        }
        $data = $request->validate(['status' => ['required', Rule::in(UrfApplication::STATUSES)]]);

        $application = UrfApplication::findOrFail($id);
        $application->status = $data['status'];
        $application->save();

        // Settling a project settles its reading, so the two cannot disagree.
        if (!$application->isComplete()) {
            $application->closeChain(Auth::user(), $data['status']);
        }

        $members = User::where('id', $application->user_id)
            ->when($application->student2_email, fn ($q, $email) => $q->orWhere('email', $email))
            ->get();
        foreach ($members as $member) {
            $this->sendNotification(
                $member,
                "URF project {$data['status']}",
                "Your URF project \"{$application->project_title}\" is now {$data['status']}.",
                '/forms'
            );
        }

        return response()->json($application);
    }

    private function payload(UrfApplication $application, User $user): array
    {
        // Stipend details are personal: a student sees only their own.
        if (!$user->may('can_manage_urf')) {
            $application->setRelation('fellows', $application->fellows->where('user_id', $user->id)->values());
        }
        // Publications belong to the reports they were linked to, not to the application.
        $data = $application->toArray();
        // What a reviewer weighs a student's eligibility on: their other URF
        // projects and what came of them. The students have their own record.
        if (!$application->hasMember($user)) {
            $data['other_projects'] = $this->otherProjects($application);
        }
        foreach ($data['reports'] ?? [] as $i => $report) {
            $data['reports'][$i]['publications'] = Publication::groupedFor('urf_application_id', $application->id, $report['id'], 'urf_report');
        }

        $data['applied_on'] = $this->submittedOn($application)?->toIso8601String();
        $data['awaiting_me'] = $application->awaits($user);
        $data['may_reject'] = $application->awaits($user) && $application->stepFor($user) === 'dordc';
        foreach ($application->reports as $i => $report) {
            $data['reports'][$i]['awaiting_me'] = $report->awaits($user);
        }
        foreach ($application->fellows as $i => $fellow) {
            $data['fellows'][$i]['awaiting_me'] = $fellow->awaits($user);
        }

        return $data;
    }

    /**
     * Each student's other URF projects: session, outcome, whether the final
     * report is in, and the publications linked to its reports. The portal does
     * not record Scopus indexing, so publications are counted by the kinds it
     * does record, and the reviewer judges eligibility from those.
     */
    private function otherProjects(UrfApplication $application): array
    {
        $students = [
            ['name' => $application->student1_name, 'email' => $application->student1_email, 'id' => $application->user_id],
            ['name' => $application->student2_name, 'email' => $application->student2_email, 'id' => null],
        ];

        return collect($students)->filter(fn ($student) => $student['email'])->map(function ($student) use ($application) {
            $id = $student['id'] ?? User::where('email', $student['email'])->value('id');
            $projects = UrfApplication::whereKeyNot($application->id)
                ->where(fn ($query) => $query->where('student2_email', $student['email'])
                    ->when($id, fn ($query) => $query->orWhere('user_id', $id)))
                ->with('reports')
                ->orderByDesc('session')
                ->get();

            return [
                'student' => $student['name'],
                'projects' => $projects->map(function (UrfApplication $project) {
                    $final = $project->reports->where('type', 'final')->sortByDesc('id')->first();
                    // The same paper is copied onto each report it is linked to,
                    // so it is counted once by title.
                    $publications = Publication::where('urf_application_id', $project->id)
                        ->where('form_type', 'urf_report')
                        ->get(['title', 'publication_type', 'type'])
                        ->unique(fn ($publication) => mb_strtolower(trim((string) $publication->title)))
                        ->countBy(fn ($publication) => $publication->publication_type . ':' . $publication->type);

                    return [
                        'id' => $project->id,
                        'session' => $project->session,
                        'project_title' => $project->project_title,
                        'status' => $project->status,
                        'final_report' => $final ? ($final->isComplete() ? 'approved' : 'filed') : null,
                        'publications' => $publications,
                    ];
                })->values(),
            ];
        })->values()->all();
    }

    /** The office reads every project, a mentor the ones they are on. */
    private function mayRead(User $user): bool
    {
        // A mentee reader with no faculty row mentors nothing, so they read an
        // empty list. Refusing them showed "not authorized" on a page the
        // capability puts in their sidebar.
        return $user->may('can_manage_urf') || $user->may('can_read_urf_mentees');
    }

    private function mentors(User $user, UrfApplication $application): bool
    {
        $code = $user->faculty?->faculty_code;

        return $code && in_array($code, [$application->mentor1_faculty_code, $application->mentor2_faculty_code], false);
    }

}
