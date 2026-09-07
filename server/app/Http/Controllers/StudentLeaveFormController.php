<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
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
    use FilterLogicTrait, GeneralFormCreate, GeneralFormHandler, GeneralFormList,
        GeneralFormSubmitter, SaveFile;

    private const STEPS = ['student', 'hod', 'complete'];

    /** The notification lands on the attendance page, not the Forms page. */
    protected function formLink($formInstance, $model): string
    {
        return '/attendance?tab=leaves&leave=' . $formInstance->id;
    }

    public function listForm(Request $request, $student_id = null)
    {
        $user = Auth::user();

        return $this->listForms($user, StudentLeaveForm::class, $request);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        if ($role->role !== 'student') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        return $this->createForms(StudentLeaveForm::class, [
            'roll_no' => $user->student->roll_no,
            'steps' => self::STEPS,
            'role' => $role->role,
            'name' => $user->first_name . ' ' . $user->last_name,
        ]);
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
        if ($user->current_role->role !== 'student') {
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
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            StudentLeaveForm::class,
            'hod',
            'student',
            'complete',
        );
    }
}
