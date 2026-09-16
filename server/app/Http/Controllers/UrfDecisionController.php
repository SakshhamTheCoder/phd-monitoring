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
 * branch's department, then the DORDC.
 *
 * Three answers. Approving passes the form on. Sending it back means not as it
 * stands: the student gets the reason and resubmits, and the reading starts
 * again. Rejecting ends the project, which only the DORDC can do, since they
 * are also the one whose approval selects it.
 *
 * The office's Select and Reject stay as an override for anything the chain
 * cannot settle, and closing a project that way closes its reading too.
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
            'decision' => 'required|in:approve,send_back,reject',
            // Anything but a yes has to say why, since the student reads it.
            'comments' => 'required_unless:decision,approve|nullable|string|max:2000',
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

        // Ending a project is the DORDC's, the same reader whose approval
        // starts it. Everyone before them may say not as it stands.
        if ($data['decision'] === 'reject' && ($step !== 'dordc' || !$instance instanceof UrfApplication)) {
            return response()->json([
                'message' => 'Only the DORDC ends a project. Send it back if it needs work.',
            ], 403);
        }

        $instance->recordDecision($user, $step, $data['decision'], $data['comments'] ?? null);

        // The DORDC's answer on an application is the project's: approved is
        // selected, rejected is rejected.
        if ($instance instanceof UrfApplication && $application->status === 'applied') {
            if ($instance->isComplete() && $data['decision'] === 'approve') {
                $application->status = 'selected';
                $application->save();
            } elseif ($data['decision'] === 'reject') {
                $application->status = 'rejected';
                $application->save();
            }
        }

        $this->tell($application, $instance, $label, $user, $data['decision'], $data['comments'] ?? null);

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
    private function tell(UrfApplication $application, $instance, string $label, User $actor, string $decision, ?string $comments): void
    {
        $title = [
            'approve' => "URF {$label} approved",
            'send_back' => "URF {$label} sent back",
            'reject' => 'URF project rejected',
        ][$decision];

        $body = [
            'approve' => "{$actor->name()} approved the {$label} for \"{$application->project_title}\".",
            'send_back' => "{$actor->name()} sent the {$label} for \"{$application->project_title}\" back: {$comments}",
            'reject' => "{$actor->name()} rejected \"{$application->project_title}\": {$comments}",
        ][$decision];

        foreach ($this->students($application) as $student) {
            $this->sendNotification($student, $title, $body, '/forms');
        }

        if ($decision === 'approve' && !$instance->isComplete()) {
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
