<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\NotificationManager;
use App\Models\UrfApplication;
use App\Models\UrfFellow;
use App\Models\UrfReport;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Reading a URF form and saying yes or no.
 *
 * The student files it, their mentor reads it, then the ADORDC of their
 * branch's department, then the DORDC. Approving passes the form on; rejecting
 * sends it back to the student with the reason, and their next submission
 * starts the reading again, because what the later steps read has changed.
 *
 * Approving an application at the last step is what selects the project: the
 * chain is the decision, and the office's Select and Reject stay as the
 * override for anything the chain cannot settle.
 */
class UrfDecisionController extends Controller
{
    use NotificationManager;

    /** The form a path names, and how to say it in a sentence. */
    private const FORMS = [
        'urf-application' => [UrfApplication::class, 'URF application'],
        'urf-additional-info' => [UrfFellow::class, 'additional information form'],
        'urf-half-yearly-report' => [UrfReport::class, 'half-yearly progress report'],
        'urf-final-report' => [UrfReport::class, 'final report'],
    ];

    public function decide(Request $request, string $form, $id)
    {
        $user = Auth::user();
        [$model, $label] = self::FORMS[$form];

        $data = $request->validate([
            'approval' => 'required|boolean',
            // A rejection sends the form back, so it has to say what to fix.
            'comments' => 'required_if:approval,false|nullable|string|max:2000',
        ]);

        $instance = $model::findOrFail($id);
        $application = $instance->approvalApplication();

        if ($instance->isComplete()) {
            return response()->json(['message' => 'This form is already through.'], 422);
        }

        $step = $instance->stepFor($user);
        if (!$step || $step === 'student' || !in_array($step, $instance::APPROVERS, true)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        if ($instance->stage !== $step) {
            return response()->json([
                'message' => "This form is waiting on {$this->name($instance->stage)}, not you.",
            ], 403);
        }

        $instance->recordDecision($user, $step, (bool) $data['approval'], $data['comments'] ?? null);

        // The last approval on an application is the project being selected.
        if ($instance instanceof UrfApplication && $instance->isComplete() && $application->status === 'applied') {
            $application->status = 'selected';
            $application->save();
        }

        $this->tell($application, $instance, $label, $user, (bool) $data['approval'], $data['comments'] ?? null);

        return response()->json([
            'stage' => $instance->stage,
            'status' => $application->fresh()->status,
        ]);
    }

    /** Everything waiting on whoever is asking, across the three forms. */
    public function queue()
    {
        $user = Auth::user();

        $waiting = collect();
        foreach ([UrfApplication::class, UrfFellow::class, UrfReport::class] as $model) {
            $rows = $model === UrfApplication::class
                ? $model::with(['student1Branch', 'mentor1', 'mentor2'])->where('stage', '!=', UrfApplication::COMPLETE)->get()
                : $model::with(['application.student1Branch'])->where('stage', '!=', UrfApplication::COMPLETE)->get();

            $waiting = $waiting->merge($rows->filter(fn ($row) => $row->awaits($user))->map(function ($row) use ($model) {
                $application = $row->approvalApplication();

                return [
                    'id' => $row->id,
                    'form' => $this->formKey($row),
                    'application_id' => $application?->id,
                    'project_title' => $application?->project_title,
                    'session' => $application?->session,
                    'students' => collect([$application?->student1_name, $application?->student2_name])->filter()->join(', '),
                    'waiting_since' => $row->updated_at?->format('d M Y'),
                ];
            }));
        }

        return response()->json([
            'data' => $waiting->sortBy('waiting_since')->values(),
            'total' => $waiting->count(),
            'fields' => ['session', 'project_title', 'students', 'form', 'waiting_since'],
            'fieldsTitles' => ['Session', 'Project Title', 'Students', 'Form', 'Waiting Since'],
        ]);
    }

    /** Which of the four forms a row is, written the way the paths are. */
    private function formKey($row): string
    {
        if ($row instanceof UrfApplication) {
            return 'urf-application';
        }

        if ($row instanceof UrfFellow) {
            return 'urf-additional-info';
        }

        return $row->type === 'final' ? 'urf-final-report' : 'urf-half-yearly-report';
    }

    private function name(string $stage): string
    {
        return [
            'student' => 'the student',
            'mentor' => 'the faculty mentor',
            'adordc' => 'the ADORDC',
            'dordc' => 'the DORDC',
        ][$stage] ?? $stage;
    }

    /**
     * Everyone who needs to know: the students when their form moves or comes
     * back, and whoever it now waits on.
     */
    private function tell(UrfApplication $application, $instance, string $label, User $actor, bool $approved, ?string $comments): void
    {
        $title = $approved ? "URF {$label} approved" : "URF {$label} sent back";
        $body = $approved
            ? "{$actor->name()} approved the {$label} for \"{$application->project_title}\"."
            : "{$actor->name()} sent the {$label} for \"{$application->project_title}\" back: {$comments}";

        foreach ($this->students($application) as $student) {
            $this->sendNotification($student, $title, $body, '/forms');
        }

        if ($approved && !$instance->isComplete()) {
            foreach ($this->nextReaders($application, $instance->stage) as $reader) {
                $this->sendNotification(
                    $reader,
                    "A URF {$label} needs your approval",
                    "The {$label} for \"{$application->project_title}\" is waiting on you.",
                    '/urf'
                );
            }
        }
    }

    private function students(UrfApplication $application)
    {
        return User::where('id', $application->user_id)
            ->when($application->student2_email, fn ($q, $email) => $q->orWhere('email', $email))
            ->get();
    }

    /** Who a form now waits on, so they hear about it rather than find it. */
    private function nextReaders(UrfApplication $application, string $stage)
    {
        if ($stage === 'mentor') {
            $codes = array_filter([$application->mentor1_faculty_code, $application->mentor2_faculty_code]);

            return User::whereHas('faculty', fn ($q) => $q->whereIn('faculty_code', $codes))->get();
        }

        if ($stage === 'adordc') {
            $department = $application->student1Branch?->department_id;

            return User::whereHas('faculty.adordcDepartments', fn ($q) => $q->when($department, fn ($inner) => $inner->where('departments.id', $department)))->get();
        }

        if ($stage === 'dordc') {
            return User::whereHas('current_role', fn ($q) => $q->where('role', 'dordc'))->get();
        }

        return collect();
    }
}
