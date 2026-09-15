<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use Illuminate\Http\Request;

use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Support\Facades\Auth;
use App\Models\PHDObjective;
use App\Models\ReviseTitleForm;

class ReviseTitleController extends Controller
{
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use GeneralFormCreate;
    use FilterLogicTrait;

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("forms"));
    }

    public function listForm(Request $request, $student_id = null)
    {
        $user = Auth::user();
        if ($student_id)
            return $this->listFormsStudent($user, ReviseTitleForm::class, $student_id);

        // The list must match the detail view (loadForm below): phd_coordinator,
        // director, adordc, doctoral and external are not steps in this form's
        // chain and loadForm 403s all of them, so they should never see a
        // populated queue either.
        if (!in_array($user->current_role->role, ['student', 'faculty', 'hod', 'dra', 'dordc', 'admin'], true)) {
            return response()->json(['message' => 'You do not have permission to view revise title forms. Contact your administrator if you believe this is a mistake.'], 403);
        }

        return $this->listForms($user, ReviseTitleForm::class, $request, null, false, [
            'fields' => ["name", "roll_no", "current_title", "proposed_title"],
            'titles' => ["Name", "Roll No", "Current Title", "Proposed Title"],
        ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps = ['student', 'faculty', 'hod', 'dra', 'dordc', 'complete'];
        if ($role->role != 'student') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $data = [
            'roll_no' => $user->student->roll_no,
            'steps' => $steps,
            'role' => $role->role,
            'name' => $user->first_name . ' ' . $user->last_name,
        ];
        // Snapshot what is currently on record, so the request still shows what
        // is being changed even after the student's own profile moves on.
        return $this->createForms(ReviseTitleForm::class, $data, function ($form) use ($user) {
            $form->current_title = $user->student->phd_title;
            $form->current_objectives = $user->student->objectives()
                ->where('type', 'revised')
                ->pluck('objective')
                ->values()
                ->toArray();
        });
    }

    public function loadForm(Request $request, $form_id = null)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        $model = ReviseTitleForm::class;
        $steps = ['student', 'faculty', 'hod', 'dra', 'dordc'];
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model, $steps);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'dra':
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'faculty':
                return $this->handleFacultyForm($user, $form_id, $model);
            case 'admin':
                return $this->handleAdminForm($user, $form_id, $model, true);

            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    public function submit(Request $request, $form_id)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;

        switch ($role->role) {
            case 'student':
                return $this->studentSubmit($user, $request, $form_id);
            case 'faculty':
                return $this->supervisorSubmit($user, $request, $form_id);
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'dra':
                return $this->draSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    private function studentSubmit($user, $request, $form_id)
    {
        $model = ReviseTitleForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'student',
            'student',
            'faculty',
            function ($formInstance) use ($request) {
                $request->validate([
                    'proposed_title' => 'required|string',
                    'justification' => 'required|string',
                    'proposed_objectives' => 'required|array|min:1',
                    'proposed_objectives.*' => 'required|string',
                ]);
                $formInstance->proposed_title = $request->proposed_title;
                $formInstance->justification = $request->justification;
                $formInstance->proposed_objectives = $request->proposed_objectives;
            }
        );
    }

    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;

        // Matches the sibling forms: the supervisor reviews their own scholars
        // one at a time, so bulk approval is left to the committee-style roles.
        $allowedRoles = ['hod', 'dra', 'dordc'];
        if (!in_array($role->role, $allowedRoles)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $request->validate([
            'form_ids' => 'required|array',
            'approval' => 'required|boolean',
        ]);
        $hasFailure = false;
        foreach ($request->form_ids as $form_id) {
            $response = $this->submit($request, $form_id);
            if ($response->getStatusCode() >= 400) {
                $hasFailure = true;
            }
        }
        return response()->json([
            'message' => $hasFailure ? 'Some forms could not be submitted' : 'Forms submitted successfully',
        ], $hasFailure ? 422 : 200);
    }

    private function supervisorSubmit($user, $request, $form_id)
    {
        $model = ReviseTitleForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'faculty',
            'student',
            'hod',
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $model = ReviseTitleForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'hod',
            'faculty',
            'dra',
        );
    }

    private function draSubmit($user, $request, $form_id)
    {
        $model = ReviseTitleForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'dra',
            'hod',
            'dordc',
        );
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        $model = ReviseTitleForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'dordc',
            'dra',
            'complete',
            function ($formInstance) use ($request, $user) {
                if ($request->approval) {
                    $formInstance->completion = 'complete';
                    $formInstance->status = 'approved';

                    // The form's whole purpose is to change these two things on
                    // the student's record. Completion is where that change
                    // actually takes effect, same as the title/objectives update
                    // IrbSubController makes at its own completion step.
                    $student = $formInstance->student;
                    $student->phd_title = $formInstance->proposed_title;
                    $student->save();

                    $student->objectives()->where('type', 'revised')->delete();
                    foreach ($formInstance->proposed_objectives ?? [] as $objective) {
                        PHDObjective::create([
                            'student_id' => $student->roll_no,
                            'objective' => $objective,
                            'type' => 'revised',
                        ]);
                    }

                    $formInstance->addHistoryEntry("Title/Objectives revision approved by DORDC", $user->name());
                }
            }
        );
    }
}
