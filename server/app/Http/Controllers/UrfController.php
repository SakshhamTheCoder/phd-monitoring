<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\NotificationManager;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\AppSetting;
use App\Models\UgBranch;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\UrfApplication;
use App\Models\UrfFellow;
use App\Models\UrfReport;
use App\Models\UrfReportWindow;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * The Undergraduate Research Fellowship. A UG student applies while the window
 * is open, gives their stipend details once selected and files reports while
 * the project runs. The admin reads every application and moves it between
 * stages; each stage is set by hand, so nothing advances on its own.
 */
class UrfController extends Controller
{
    use FilterLogicTrait;
    use NotificationManager;
    use SaveFile;

    /** The stage tab is a filter of the page's own, not one of its fields. */
    private const SEARCH_KEYS = ['status'];

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

        // Newest session first, and within a session the latest application first.
        $query = UrfApplication::with([
            'student1Branch', 'student2Branch',
            // The department comes along for the mentor's code beside their
            // name: one more query for the page, not one per row.
            'mentor1.user', 'mentor1.department:id,code', 'mentor2.user', 'mentor2.department:id,code',
        ])
            ->orderByDesc('session')
            ->latest('id');

        // A mentor reads the projects they are named on, and nothing else.
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
                // Branch and year are one answer about a student, so they read
                // as one. Two students of the same branch and year say it once.
                'branch' => collect([
                    [$a->student1Branch?->name, $a->student1_year],
                    [$a->student2Branch?->name, $a->student2_year],
                ])->map(fn ($pair) => collect([$pair[0], UrfApplication::yearLabel($pair[1])])->filter()->join(', '))
                    ->filter()->unique()->join(' · '),
                'mentors' => collect([$a->mentor1, $a->mentor2])->filter()
                    ->map(fn ($m) => collect([$m->user?->name(), $m->department?->code])->filter()->join(' · '))
                    ->join(', '),
                // Not a column of its own: the mentors cell links each name.
                'mentor_list' => collect([$a->mentor1, $a->mentor2])->filter()->map(fn ($m) => [
                    'code' => $m->faculty_code,
                    'name' => $m->user?->name(),
                    'department' => $m->department?->code,
                ])->values(),
                'status' => ucfirst($a->status),
                // Where the application has reached, which is not the same as
                // whether the project is on.
                'stage' => $a->isComplete() ? 'Approved' : 'With ' . ucfirst($a->stage),
                'applied_on' => $a->created_at?->format('d M Y'),
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

    /**
     * One form's submissions for the forms grid: every application, every set
     * of stipend details or every report. The filter bar's conditions are on
     * the project, and each row carries its project so it can open it.
     */
    public function formList(Request $request, string $form)
    {
        if ($form === 'urf-application') {
            return $this->list($request);
        }
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        $filters = json_decode((string) $request->query('filters'), true);
        $details = $form === 'urf-additional-info';
        $page = ($details ? UrfFellow::query() : UrfReport::where('type', $form === 'urf-final-report' ? 'final' : 'half_yearly'))
            ->with(['application.student1Branch', 'application.student2Branch', 'user'])
            ->when($filters, fn ($q) => $q->whereHas('application', fn ($a) => $this->applyDynamicFilters($a, $filters, 'urf', self::SEARCH_KEYS)))
            ->latest('id')
            ->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        // The row's student, found on the application by their email. Branch
        // and year read as one answer, the way the projects table shows them.
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
            'submitted_on' => $row->created_at?->format('d M Y'),
        ];

        return response()->json([
            'data' => $page->getCollection()->map(fn ($row) => $common($row) + $student($row) + ($details ? [
                'student' => $row->full_name,
                'status' => ucfirst($row->application->status),
            ] : [
                'submitted_by' => $row->user->name(),
                'conference_presentation' => $row->conference_presentation,
                'report' => $row->report,
            ])),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => $details
                ? ['session', 'student', 'branch', 'project_title', 'status', 'submitted_on']
                : ['session', 'project_title', 'submitted_by', 'branch', 'conference_presentation', 'submitted_on', 'report'],
            'fieldsTitles' => $details
                ? ['Session', 'Student', 'Branch and Year', 'Project Title', 'Project Status', 'Submitted On']
                : ['Session', 'Project Title', 'Submitted By', 'Branch and Year', 'Conference Presentation', 'Submitted On', 'Report'],
        ]);
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

    /**
     * Branches for the application's dropdown, and for sign-up. Public: a
     * student picking their branch has no account yet, and which branches the
     * institute teaches is not something the portal keeps to itself.
     */
    public function branches()
    {
        return response()->json(UgBranch::ordered()->get(['id', 'programme', 'code', 'name']));
    }

    /** The sessions that have projects, newest first, for the year picker. */
    public function sessions()
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        return response()->json(
            UrfApplication::distinct()->orderByDesc('session')->pluck('session')->values()
        );
    }

    /** The rounds, newest session first, for the page that schedules them. */
    public function reportWindows()
    {
        if (!Auth::user()->may('can_manage_urf')) {
            return $this->refuse();
        }

        return response()->json(UrfReportWindow::orderByDesc('session')->orderBy('type')->get());
    }

    /**
     * Open a round, or correct one already open. One per session per kind of
     * report, so scheduling the same round twice moves its dates rather than
     * leaving fellows with two of them.
     */
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
        $window->fill($data)->save();

        return response()->json($window, 201);
    }

    /** Call off a round. Reports already filed stay where they are. */
    public function deleteReportWindow($id)
    {
        if (!Auth::user()->may('can_manage_urf')) {
            return $this->refuse();
        }

        UrfReportWindow::findOrFail($id)->delete();

        return response()->json(['message' => 'Round removed']);
    }

    /**
     * The student pages: every URF project the student is on, newest first,
     * whether applications are open, and the session a new one would join.
     */
    public function mine()
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_urf')) {
            return $this->refuse();
        }

        return response()->json([
            'applications_open' => (bool) AppSetting::value('urf', 'applications_open'),
            'session' => (int) now()->year,
            // What the student gave at sign-up, so the application form asks for
            // it once rather than every year. Absent for an account an admin
            // created, and then the form asks for all three as it used to.
            'student' => $user->ugStudent()->with('branch:id,programme,code,name')->first(),
            // Which report rounds are open, so a fellow is offered a report
            // when there is one to file and told when there is not.
            'report_windows' => UrfReportWindow::orderByDesc('session')->get(),
            'applications' => UrfApplication::forMember($user)->with(self::DETAIL)->orderByDesc('session')->latest('id')->get()
                ->map(fn (UrfApplication $application) => $this->payload($application, $user))
                ->values(),
        ]);
    }

    /**
     * Applies, or corrects an application that is still waiting for a result.
     * A rejected application leaves the student free to apply afresh.
     */
    public function apply(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_urf')) {
            return $this->refuse();
        }
        if (!AppSetting::value('urf', 'applications_open')) {
            return response()->json(['message' => 'URF applications are closed'], 422);
        }

        // One application per student per session, the calendar year. A rejected
        // one leaves the student free to apply again in the same year.
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
        if ($editing && $application->user_id !== $user->id) {
            return response()->json(['message' => 'Only the student who applied can change the application'], 403);
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

        // The applicant's own roll number and branch come from their account, so
        // the form cannot post something else and they cannot drift between
        // applications. Year of study moves with the student, so the
        // application's answer updates the account instead.
        if ($record = $user->ugStudent) {
            $data['student1_roll_no'] = $record->roll_no;
            $data['student1_branch_id'] = $record->branch_id;
            // The application records the year they are in this session, so a
            // student who has moved up says so here and their account follows.
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
        // Filed or corrected, the reading starts again at the mentor: what the
        // later steps saw is not what is in front of them now.
        $application->backToTheStartOfTheChain($user);
        $this->commitFileDeletions();

        return response()->json($application, $editing ? 200 : 201);
    }

    /** The details a selected student gives for the stipend, one set per student. */
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

        $keys = ['urf_application_id' => $application->id, 'user_id' => $user->id];
        $fellow = UrfFellow::where($keys)->first() ?? (new UrfFellow())->forceFill($keys);
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
        // The chosen library entries arrive as JSON beside the file in multipart data.
        $chosen = fn ($value) => is_array($value) ? $value : (json_decode((string) $value, true) ?: []);
        $linked = ['publications' => $chosen($request->input('publications')), 'patents' => $chosen($request->input('patents'))];
        $data['report'] = $this->saveUploadedFile($request->file('report'), 'urf_report', $user->id);

        $report = DB::transaction(function () use ($data, $application, $user, $linked) {
            // A report sent back is replaced rather than filed twice: the
            // student is answering what was said about this one.
            $report = UrfReport::where('urf_application_id', $application->id)
                ->where('user_id', $user->id)
                ->where('type', $data['type'])
                ->where('stage', 'student')
                ->first() ?? (new UrfReport())->forceFill(['urf_application_id' => $application->id, 'user_id' => $user->id]);
            $report->fill($data);
            $report->save();

            // Linked the way a PhD progress form links them: a copy of each chosen
            // entry from the student's own library, tagged with this report and
            // its project. The library entry stays for later reports.
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

        // The office settling a project settles its reading too, so the two
        // cannot disagree about whether anything is still waiting.
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
        // Stipend details are personal: a student sees only their own, and a
        // mentor has no business with anyone's bank account.
        if (!$user->may('can_manage_urf')) {
            $application->setRelation('fellows', $application->fellows->where('user_id', $user->id)->values());
        }

        // Publications belong to the reports they were linked to, not to the application.
        $data = $application->toArray();
        foreach ($data['reports'] ?? [] as $i => $report) {
            $data['reports'][$i]['publications'] = Publication::groupedFor('urf_application_id', $application->id, $report['id'], 'urf_report');
        }

        // Whether each form is waiting on whoever is reading, which is what
        // decides if they are offered the decision on it.
        $data['awaiting_me'] = $application->awaits($user);
        // Ending a project is the DORDC's alone, so the page offers it to
        // nobody else.
        $data['may_reject'] = $application->awaits($user) && $application->stepFor($user) === 'dordc';
        foreach ($application->reports as $i => $report) {
            $data['reports'][$i]['awaiting_me'] = $report->awaits($user);
        }
        foreach ($application->fellows as $i => $fellow) {
            $data['fellows'][$i]['awaiting_me'] = $fellow->awaits($user);
        }

        return $data;
    }

    /** The office reads every project; a mentor reads the ones they are on. */
    private function mayRead(User $user): bool
    {
        return $user->may('can_manage_urf')
            || ($user->may('can_read_urf_mentees') && $user->faculty?->faculty_code);
    }

    private function mentors(User $user, UrfApplication $application): bool
    {
        $code = $user->faculty?->faculty_code;

        return $code && in_array($code, [$application->mentor1_faculty_code, $application->mentor2_faculty_code], false);
    }

    private function refuse()
    {
        return response()->json(['message' => 'You are not authorized to access this resource'], 403);
    }
}
