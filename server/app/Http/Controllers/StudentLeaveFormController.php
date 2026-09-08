<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\StudentLeaveForm;
use App\Support\LeaveBalance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * A leave application: student to HOD, and no further.
 *
 * It creates no `forms` row, so it never appears in the Forms page — the
 * scholar applies from the attendance page and the HOD decides there too.
 * GeneralFormSubmitter still drives the stage machinery and the notifications.
 */
class StudentLeaveFormController extends Controller
{
    use FilterLogicTrait, GeneralFormHandler, GeneralFormList,
        GeneralFormSubmitter, SaveFile;

    private const STEPS = ['student', 'hod', 'complete'];

    /** The notification lands on the attendance page, not the Forms page. */
    protected function formLink($formInstance, $model): string
    {
        return '/attendance?tab=leaves&leave=' . $formInstance->id;
    }

    /**
     * mapForm()'s base fields (name, roll_no, status, ...) say nothing about
     * what was actually applied for, so the HOD's review table needs these
     * spelled out as extra_fields the same way every other form controller
     * does (see e.g. StudentSemesterOffFormController::listForm).
     */
    public function listForm(Request $request, $student_id = null)
    {
        $user = Auth::user();

        return $this->listForms($user, StudentLeaveForm::class, $request, null, false, [
            'fields' => ['leave_type', 'from_date', 'to_date', 'day_part'],
            'extra_fields' => ['leave_type', 'from_date', 'to_date', 'day_part'],
            'titles' => ['Type', 'From', 'To', 'Part'],
        ]);
    }

    /**
     * Deliberately bypasses GeneralFormCreate::createForms(): that helper
     * looks up a `Forms` row for the form type and refuses when there is
     * none, but leave has no `Forms` row by design (see the class docblock).
     * It also refuses a create while an earlier form is incomplete, which is
     * right for a one-shot form like semester-off but wrong here — a scholar
     * legitimately has several leave applications open across a year.
     */
    public function createForm(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_apply_for_leave')) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        $form = StudentLeaveForm::create([
            'student_id' => $user->student->roll_no,
            'status' => 'draft',
            'stage' => 'student',
            'student_lock' => false,
            'steps' => self::STEPS,
        ]);
        $form->addHistoryEntry('Form has been initiated', $user->first_name . ' ' . $user->last_name);
        $form->save();

        return response()->json(['message' => 'Form Created', 'id' => $form->id], 200);
    }

    public function loadForm(Request $request, $form_id = null)
    {
        $user = Auth::user();
        $steps = ['student', 'hod'];

        switch ($user->current_role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, StudentLeaveForm::class, $steps);
            case 'hod':
                return $this->handleHodForm($user, $form_id, StudentLeaveForm::class);
            case 'admin':
                return $this->handleAdminForm($user, $form_id, StudentLeaveForm::class, true);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    public function submit(Request $request, $form_id)
    {
        $user = Auth::user();

        switch ($user->current_role->role) {
            case 'student':
                return $this->studentSubmit($user, $request, $form_id);
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    /** The scholar's own balance, for the panel on the apply form. */
    public function balance(Request $request)
    {
        $user = Auth::user();
        if (!$user->may('can_read_own_leave_balance')) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        return response()->json(
            LeaveBalance::for((int) $user->student->roll_no, $request->input('on', now()->toDateString())),
            200
        );
    }

    private function studentSubmit($user, $request, $form_id)
    {
        $request->validate([
            'leave_type' => 'required|in:casual,academic',
            'from_date' => 'required|date',
            'to_date' => 'required|date|after_or_equal:from_date',
            'day_part' => 'required|in:full,first_half,second_half',
            'reason' => 'required|string|max:1000',
            'supporting_document' => 'nullable|file|mimes:pdf|max:20480',
        ]);

        // A half-day has meaning only on a single day; a multi-day range must be
        // full, or the 0.5 charge would be ambiguous.
        if ($request->input('day_part') !== 'full'
            && $request->input('from_date') !== $request->input('to_date')) {
            return response()->json([
                'message' => 'A half-day leave must start and end on the same day.',
            ], 422);
        }

        if ($request->input('leave_type') === 'academic' && !$request->hasFile('supporting_document')) {
            return response()->json([
                'message' => 'An academic leave needs a supporting document.',
            ], 422);
        }

        if ($request->input('leave_type') === 'casual' && $request->hasFile('supporting_document')) {
            return response()->json([
                'message' => 'A casual leave takes no supporting document.',
            ], 422);
        }

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            StudentLeaveForm::class,
            'student',
            'student',
            'hod',
            function ($formInstance) use ($request, $user) {
                // A form created directly (not through createForm) has no steps
                // yet; handleMoveToNextLevel needs them to find the next stage.
                if (empty($formInstance->steps)) {
                    $formInstance->steps = self::STEPS;
                }

                $formInstance->leave_type = $request->input('leave_type');
                $formInstance->from_date = $request->input('from_date');
                $formInstance->to_date = $request->input('to_date');
                $formInstance->day_part = $request->input('day_part');
                $formInstance->reason = $request->input('reason');

                if ($request->hasFile('supporting_document')) {
                    $formInstance->supporting_document = $this->replaceUploadedFile(
                        $formInstance->supporting_document,
                        $request->file('supporting_document'),
                        'student_leave',
                        $user->student->roll_no
                    );
                }
            }
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $response = $this->submitForm(
            $user,
            $request,
            $form_id,
            StudentLeaveForm::class,
            'hod',
            'student',
            'complete',
            function ($formInstance) use ($request, $user) {
                // A rejection is handled by the shared fallback-to-previous-level
                // machinery in GeneralFormSubmitter, which returns before this
                // closure ever runs — see the rejection handling below instead.
                if ($request->approval) {
                    $formInstance->completion = 'complete';
                    $formInstance->status = 'approved';
                    $formInstance->addHistoryEntry('Leave approved by HOD', $user->name());

                    // GeneralFormSubmitter::handleMoveToNextLevel only calls
                    // formNotification when $nextLevel is NOT 'complete' (see its
                    // rejection-path counterpart, handleFallbackToPreviousLevel,
                    // which does notify). Leave's only approval step *is* that
                    // terminal transition, so without this the scholar is never
                    // told their leave was approved. Sent here rather than in the
                    // shared trait itself: 12 other form controllers depend on
                    // today's terminal-transition (no notification) behaviour.
                    $studentUser = $formInstance->student?->user;
                    if ($studentUser) {
                        $this->sendNotification(
                            $studentUser,
                            'Your leave application has been approved',
                            'Your ' . $formInstance->leave_type . ' leave application has been approved by the HOD.',
                            $this->formLink($formInstance, StudentLeaveForm::class),
                            null,
                            true
                        );
                    }
                }
            }
        );

        // handleFallbackToPreviousLevel moves stage back to 'student' but never
        // touches status, so a rejected leave stays 'pending' forever: the
        // scholar sees a "pending" badge on a dead application and it
        // permanently inflates the HOD's pending queue. For a multi-stage form
        // bouncing back for revision that status is right; for leave it is not
        // — the HOD's decision is terminal and the scholar can simply apply
        // again (concurrent applications are already allowed). This can't live
        // in the extraSteps closure above: submitForm returns from
        // handleFallbackToPreviousLevel on a rejection before extraSteps is
        // ever invoked. Stage itself is left exactly as the trait set it —
        // only status/completion are added here.
        if (!$request->approval && $response->getStatusCode() === 200) {
            $formInstance = StudentLeaveForm::find($form_id);
            if ($formInstance) {
                $formInstance->status = 'rejected';
                $formInstance->completion = 'complete';
                $formInstance->addHistoryEntry('Leave rejected by HOD', $user->name());
                $formInstance->save();
            }
        }

        return $response;
    }
}
