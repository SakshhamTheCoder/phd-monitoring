<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\NotificationManager;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\AppSetting;
use App\Models\Department;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\UrfApplication;
use App\Models\UrfFellow;
use App\Models\UrfReport;
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
        'student1Department', 'student2Department',
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
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        // Newest session first, and within a session the latest application first.
        $query = UrfApplication::with(['student1Department', 'student2Department', 'mentor1.user', 'mentor2.user'])
            ->orderByDesc('session')
            ->latest('id');
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
                // Two students of the same branch or year say it once.
                'department' => collect([$a->student1Department?->name, $a->student2Department?->name])->filter()->unique()->join(', '),
                'year' => collect([$a->student1_year, $a->student2_year])->filter()->map(fn ($y) => UrfApplication::yearLabel($y))->unique()->join(', '),
                'mentors' => collect([$a->mentor1, $a->mentor2])->filter()->map(fn ($m) => $m->user?->name())->join(', '),
                // Not a column of its own: the mentors cell links each name.
                'mentor_list' => collect([$a->mentor1, $a->mentor2])->filter()->map(fn ($m) => [
                    'code' => $m->faculty_code,
                    'name' => $m->user?->name(),
                ])->values(),
                'status' => ucfirst($a->status),
                'applied_on' => $a->created_at?->format('d M Y'),
                // Not a column of its own: the title opens it.
                'proposal' => $a->proposal,
            ]),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => ['session', 'project_title', 'students', 'department', 'year', 'mentors', 'status', 'applied_on'],
            'fieldsTitles' => ['Session', 'Project Title', 'Students', 'Branches', 'Years', 'Mentors', 'Status', 'Applied On'],
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
            ->with(['application.student1Department', 'application.student2Department', 'user'])
            ->when($filters, fn ($q) => $q->whereHas('application', fn ($a) => $this->applyDynamicFilters($a, $filters, 'urf', self::SEARCH_KEYS)))
            ->latest('id')
            ->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        // The row's student, found on the application by their email.
        $student = function ($row) {
            $n = $row->application->slotOf($row->user);
            return [
                'roll_no' => $row->application->{"student{$n}_roll_no"},
                'branch' => $row->application->{"student{$n}Department"}?->name,
                'year' => UrfApplication::yearLabel($row->application->{"student{$n}_year"}),
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
                ? ['session', 'student', 'roll_no', 'branch', 'year', 'project_title', 'status', 'submitted_on']
                : ['session', 'project_title', 'submitted_by', 'roll_no', 'branch', 'year', 'conference_presentation', 'submitted_on', 'report'],
            'fieldsTitles' => $details
                ? ['Session', 'Student', 'Roll No', 'Branch', 'Year', 'Project Title', 'Project Status', 'Submitted On']
                : ['Session', 'Project Title', 'Submitted By', 'Roll No', 'Branch', 'Year', 'Conference Presentation', 'Submitted On', 'Report'],
        ]);
    }

    public function show($id)
    {
        $user = Auth::user();
        if (!$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        return response()->json($this->payload(UrfApplication::with(self::DETAIL)->findOrFail($id), $user));
    }

    /** Branches for the application's dropdown: the portal's departments. */
    public function departments()
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_urf') && !$user->may('can_manage_urf')) {
            return $this->refuse();
        }

        return response()->json(Department::orderBy('name')->get(['id', 'name']));
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
            'student1_department_id' => 'required|exists:departments,id',
            'student1_year' => 'required|integer|between:1,4',
            'student1_gender' => 'required|in:Male,Female',
            'student1_email' => 'required|email',
            'student1_phone' => 'required|string|max:20',
            'student2_name' => 'nullable|string|max:255',
            'student2_roll_no' => "$second|string|max:50",
            'student2_department_id' => "$second|exists:departments,id",
            'student2_year' => "$second|integer|between:1,4",
            'student2_gender' => "$second|in:Male,Female",
            'student2_email' => "$second|email|different:student1_email",
            'student2_phone' => "$second|string|max:20",
            'mentor1_faculty_code' => ['required', $internalFaculty],
            'mentor2_faculty_code' => ['nullable', 'different:mentor1_faculty_code', $internalFaculty],
            'proposal' => ($editing ? 'nullable' : 'required') . '|file|mimes:pdf|max:20480',
        ]);

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
        // The chosen library entries arrive as JSON beside the file in multipart data.
        $chosen = fn ($value) => is_array($value) ? $value : (json_decode((string) $value, true) ?: []);
        $linked = ['publications' => $chosen($request->input('publications')), 'patents' => $chosen($request->input('patents'))];
        $data['report'] = $this->saveUploadedFile($request->file('report'), 'urf_report', $user->id);

        $report = DB::transaction(function () use ($data, $application, $user, $linked) {
            $report = (new UrfReport($data))->forceFill(['urf_application_id' => $application->id, 'user_id' => $user->id]);
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
        foreach ($data['reports'] ?? [] as $i => $report) {
            $data['reports'][$i]['publications'] = Publication::groupedFor('urf_application_id', $application->id, $report['id'], 'urf_report');
        }

        return $data;
    }

    private function refuse()
    {
        return response()->json(['message' => 'You are not authorized to access this resource'], 403);
    }
}
