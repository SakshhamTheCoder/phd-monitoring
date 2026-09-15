<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\NotificationManager;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\AppSetting;
use App\Models\Publication;
use App\Models\UrfApplication;
use App\Models\UrfFellow;
use App\Models\UrfReport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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

        $query = UrfApplication::with(['student1Department', 'mentor1.user', 'mentor2.user'])->latest('id');
        $filters = json_decode((string) $request->query('filters'), true);
        if ($filters) {
            $query = $this->applyDynamicFilters($query, $filters);
        }
        $page = $query->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        return response()->json([
            'data' => $page->getCollection()->map(fn (UrfApplication $a) => [
                'id' => $a->id,
                'project_title' => $a->project_title,
                'students' => collect([$a->student1_name, $a->student2_name])->filter()->join(', '),
                'roll_no' => $a->student1_roll_no,
                'department' => $a->student1Department?->name,
                'mentors' => collect([$a->mentor1, $a->mentor2])->filter()->map(fn ($m) => $m->user?->name())->join(', '),
                'status' => ucfirst($a->status),
                'applied_on' => $a->created_at?->format('d M Y'),
            ]),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => ['project_title', 'students', 'roll_no', 'department', 'mentors', 'status', 'applied_on'],
            'fieldsTitles' => ['Project Title', 'Students', 'Roll No', 'Department', 'Mentors', 'Status', 'Applied On'],
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
        $page = ($details ? UrfFellow::query() : UrfReport::query())
            ->with(['application', 'user'])
            ->when($filters, fn ($q) => $q->whereHas('application', fn ($a) => $this->applyDynamicFilters($a, $filters)))
            ->latest('id')
            ->paginate($request->input('rows', 50), ['*'], 'page', $request->input('page', 1));

        $common = fn ($row) => [
            'id' => $row->id,
            'application_id' => $row->urf_application_id,
            'project_title' => $row->application->project_title,
            'submitted_on' => $row->created_at?->format('d M Y'),
        ];
        $reportTypes = ['half_yearly' => 'Half-yearly Progress Report', 'final' => 'Final Report'];

        return response()->json([
            'data' => $page->getCollection()->map(fn ($row) => $common($row) + ($details ? [
                'student' => $row->full_name,
                'roll_no' => strcasecmp((string) $row->application->student2_email, $row->user->email) === 0
                    ? $row->application->student2_roll_no
                    : $row->application->student1_roll_no,
                'status' => ucfirst($row->application->status),
            ] : [
                'submitted_by' => $row->user->name(),
                'report_type' => $reportTypes[$row->type] ?? $row->type,
                'conference_presentation' => $row->conference_presentation,
                'report' => $row->report,
            ])),
            'total' => $page->total(),
            'totalPages' => $page->lastPage(),
            'role' => $user->current_role->role,
            'fields' => $details
                ? ['student', 'roll_no', 'project_title', 'status', 'submitted_on']
                : ['project_title', 'submitted_by', 'report_type', 'conference_presentation', 'submitted_on', 'report'],
            'fieldsTitles' => $details
                ? ['Student', 'Roll No', 'Project Title', 'Project Status', 'Submitted On']
                : ['Project Title', 'Submitted By', 'Report', 'Conference Presentation', 'Submitted On', 'File'],
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

    /** The student page: their project, if they have one, and whether applications are open. */
    public function mine()
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_urf')) {
            return $this->refuse();
        }

        $application = UrfApplication::forUser($user);

        return response()->json([
            'applications_open' => (bool) AppSetting::value('urf', 'applications_open'),
            'application' => $application ? $this->payload($application->load(self::DETAIL), $user) : null,
        ]);
    }

    /**
     * Applies, or corrects an application that is still waiting for a result.
     * A rejected or completed project leaves the student free to apply afresh.
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

        $application = UrfApplication::forUser($user);
        if ($application && in_array($application->status, ['selected', 'ongoing'], true)) {
            return response()->json(['message' => 'Your URF project is already under way'], 422);
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
            'student1_gender' => 'required|in:Male,Female',
            'student1_email' => 'required|email',
            'student1_phone' => 'required|string|max:20',
            'student2_name' => 'nullable|string|max:255',
            'student2_roll_no' => "$second|string|max:50",
            'student2_department_id' => "$second|exists:departments,id",
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
        if (!in_array($application->status, ['selected', 'ongoing'], true)) {
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
        if ($application->status !== 'ongoing') {
            return response()->json(['message' => 'Reports are filed while the project is ongoing'], 422);
        }

        $data = $request->validate([
            'type' => 'required|in:half_yearly,final',
            'conference_presentation' => 'nullable|string|max:2000',
            'report' => 'required|file|mimes:pdf|max:20480',
        ]);
        $data['report'] = $this->saveUploadedFile($request->file('report'), 'urf_report', $user->id);

        $report = (new UrfReport($data))->forceFill(['urf_application_id' => $application->id, 'user_id' => $user->id]);
        $report->save();

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

        return $application->toArray() + [
            'publications' => Publication::groupedFor('urf_application_id', $application->id),
        ];
    }

    private function refuse()
    {
        return response()->json(['message' => 'You are not authorized to access this resource'], 403);
    }
}
