<?php

namespace App\Http\Controllers\Traits;


use App\Models\Forms;
use App\Models\Presentation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

trait GeneralFormSubmitter
{
    use NotificationManager;
    // Uploads swapped in by an extraSteps callback queue their superseded file
    // here, and submitForm decides whether that queue is committed or dropped.
    use SaveFile;
    private function submitForm($user, Request $request, $form_id, $model, $role, $previousLevel, $nextLevel, callable $extraSteps = null)
    {
        Log::info('Submitting form with ID: ' . $form_id);
        Log::info('Model: ' . $model);
        Log::info('Role: ' . $role);
        Log::info('Previous Level: ' . $previousLevel);
        Log::info('Next Level: ' . $nextLevel);
        if ($role != 'student') {
            $request->validate([
                'approval' => 'required|boolean',
                'comments' => 'string|nullable',
            ]);
        }
        // Check if comments are required
        if ($role != 'student' && !$request->approval && empty($request->comments)) {
            return response()->json(['message' => 'Comments are required when approval is false'], 403);
        }

        try {
            $formInstance = $model::where('id', $form_id)->first();
            if (!$formInstance) {
                return response()->json(['message' => 'No form found'], 404);
            }

            if ($formInstance->completion === 'complete') {
                return response()->json(['message' => 'Form already completed'], 403);
            }


            if ($formInstance->{$role . '_lock'} || ($role == 'faculty' && $formInstance->supervisor_lock)) {
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
            }
            Log::info('Form instance found: ' . $formInstance->id);
            $this->handleRoleSpecificLogic($user, $formInstance, $role, $extraSteps);

            if ($role != 'student') {
                if (!$request->approval) {
                    Log::info('Form rejected by: ' . $user->name());
                    $this->updateApprovalAndComments($formInstance, $request, $role);
                    return $this->handleFallbackToPreviousLevel($user, $formInstance, $previousLevel, $request->comments, $model);
                }
            }


            if ($extraSteps) {
                $extraSteps($formInstance, $user);
            }

            if ($role != 'student') {

                Log::info('Form approved by: ' . $user->name());
                $this->updateApprovalAndComments($formInstance, $request, $role);
            } else {
                $formInstance->student_lock = true;
            }
            $this->handleMoveToNextLevel($formInstance, $nextLevel, $model);

            $formInstance->addHistoryEntry($this->getSubmissionMessage($user->current_role, $user->name()), $user->name());
            $formInstance->save();
            // The new paths are persisted, so the files they replaced can go.
            $this->commitFileDeletions();
            return response()->json([
                'message' => 'Form submitted successfully',
                'completed' => $formInstance->completion === 'complete',
            ]);
        } catch (ValidationException $e) {
            $this->discardFileDeletions();
            Log::error('Validation error in form submission: ' . $e->getMessage());
            return response()->json(['errors' => $e->errors()], 422);
        } catch (QueryException $e) {
            // A database error's message carries the full SQL, table and index names,
            // and the generic handler below returns getMessage() straight to the
            // browser — so it would be shown to the user verbatim. Log the detail and
            // hand back something safe. The deliberate domain exceptions below are
            // written for users and still pass through unchanged.
            $this->discardFileDeletions();
            Log::error('Database error in form submission: ' . $e->getMessage());
            return response()->json([
                'message' => 'This could not be saved. Please check the details and try again.',
            ], 403);
        } catch (\Exception $e) {
            $this->discardFileDeletions();
            Log::error('Error in form submission: ' . $e->getMessage());
            if ($e->getCode() == 201) {
                return response()->json(['message' => $e->getMessage()], 201);
            }
            return response()->json(['message' => $e->getMessage()], 403);
        }
    }

    private function updateApprovalAndComments($formInstance, Request $request, $role)
    {
        // Update approval fields based on role
        if ($request->approval) {
            switch ($role) {
                case 'faculty':
                    $formInstance->supervisor_approval = true;
                    break;

                case 'phd_coordinator':
                    $formInstance->phd_coordinator_approval = true;
                    break;

                case 'hod':
                    $formInstance->hod_approval = true;

                    break;

                case 'dordc':
                    $formInstance->dordc_approval = true;

                    break;
                case 'adordc':
                    $formInstance->adordc_approval=true;
                    break;
                case 'dra':
                    $formInstance->dra_approval = true;

                    break;
                case 'external':
                    $formInstance->external_approval = true;

                    break;
                case 'doctoral':
                    $formInstance->doctoral_approval = true;

                    break;
                case 'director':
                    $formInstance->director_approval = true;

                    break;

                default:
                    break;
            }
        }

        switch ($role) {
            case 'faculty':
                $formInstance->supervisor_comments = $request->comments;
                $formInstance->supervisor_lock = true;
                break;

            case 'phd_coordinator':
                $formInstance->phd_coordinator_comments = $request->comments;
                $formInstance->phd_coordinator_lock = true;
                break;

            case 'hod':
                $formInstance->hod_comments = $request->comments;
                $formInstance->hod_lock = true;
                break;
            case 'adordc':
                $formInstance->adordc_comments=$request->comments;
                $formInstance->adordc_lock = true;
            case 'dordc':
                $formInstance->dordc_comments = $request->comments;
                $formInstance->dordc_lock = true;
                break;

            case 'dra':
                $formInstance->dra_comments = $request->comments;
                $formInstance->dra_lock = true;
                break;

            case 'external':
                $formInstance->external_comments = $request->comments;
                $formInstance->external_lock = true;
                break;

            case 'director':
                $formInstance->director_comments = $request->comments;
                $formInstance->director_lock = true;
                break;
            case 'doctoral':
                $formInstance->doctoral_comments = $request->comments;
                $formInstance->doctoral_lock = true;
                break;
            default:
                break;
        }
    }

    private function handleFallbackToPreviousLevel($user, $formInstance, $previousLevel, $comments, $model)
    {

        $link = '/forms/' . $this->getFormType($model) . '/' . $formInstance->id;
        if ($this->getFormType($model) == 'presentation') {
            $link = '/presentation/semester/' . $formInstance->period_of_report . '/' . $formInstance->id;
        }
        $this->formNotification($formInstance->student, $this->getFormType($model) . ' form for ' . $formInstance->student?->user->name() . ' has been rejected', 'Form has been rejected',  $link, $previousLevel, true);

        if ($previousLevel == 'faculty') {
            $previousLevel = 'supervisor';
        }
        $index = array_search($previousLevel, $formInstance->steps);
        $formInstance->update([
            'stage' => $previousLevel,
            'current_step' => $index,
            'maximum_step' => $index > $formInstance->maximum_step ? $index : $formInstance->maximum_step,
            // Unlock the current level's lock
            $this->getUnlockField($previousLevel) => false,
        ]);

        $formInstance->addHistoryEntry($this->getRejectionMessage($user->current_role, $user->name()),  $user->name(), $comments);

        return response()->json(['message' => 'Form Rejected successfully'], 200);
    }

    private function handleMoveToNextLevel($formInstance, $nextLevel, $model)
    {
        $student_id = $formInstance->student->roll_no;
        $index = array_search($nextLevel, $formInstance->steps);

        Log::info('Next Level Post Approval: ' . $nextLevel);
        if ($nextLevel == 'complete') {
            $formInstance->completion = 'complete';
            $formInstance->stage = 'complete';
            $formInstance->current_step = $index;
            $formInstance->maximum_step = $index > $formInstance->maximum_step ? $index : $formInstance->maximum_step;
        } else {
            $link = '/forms/' . $this->getFormType($model) . '/' . $formInstance->id;
            if ($this->getFormType($model) == 'presentation') {
                $link = '/presentation/semester/' . $formInstance->period_of_report . '/' . $formInstance->id;
            }
            $this->formNotification($formInstance->student, $this->getFormType($model) . ' form for ' . $formInstance->student?->user?->name() . ' has pending action', 'Form has pending  action',  $link, $nextLevel, true);
            if ($nextLevel == 'faculty') {
                $nextLevel = 'supervisor';
            }
            $formInstance->update([
                'stage' => $nextLevel,
                $nextLevel . '_approval' => false,
                $nextLevel . '_comments' => null,
                'status' => 'pending',
                'current_step' => $index,
                'maximum_step' => $index > $formInstance->maximum_step ? $index : $formInstance->maximum_step,
                $this->getUnlockField($nextLevel) => false,
            ]);
        }
        $this->updateForm($model, $student_id, $nextLevel);
    }


    private function getUnlockField($stage)
    {
        return match ($stage) {
            'student' => 'student_lock',
            'supervisor' => 'supervisor_lock',
            'phd_coordinator' => 'phd_coordinator_lock',
            'hod' => 'hod_lock',
            'dordc' => 'dordc_lock',
            'adordc'=>'adordc_lock',
            'dra' => 'dra_lock',
            'external' => 'external_lock',
            'director' => 'director_lock',
            'doctoral' => 'doctoral_lock',
            default => null,
        };
    }



    private function handleRoleSpecificLogic($user, $formInstance, $role)
    {

        switch ($role) {
            case 'student':
                if ($formInstance->student_id != $user->student->roll_no) {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            case 'faculty':
                if (!$formInstance->student->checkSupervises($user->faculty->faculty_code)) {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            case 'phd_coordinator':
                if (!$formInstance->student->department->checkCoordinates($user->faculty->faculty_code)) {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            case 'hod':
                if ($formInstance->student->department->hod_id != $user->faculty->faculty_code) {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            case 'external':
                if (false) {
                    //outside cond update
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;
            case 'doctoral':
                if (!$formInstance->student->checkDoctoralCommittee($user->faculty->faculty_code)) {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;
            case 'adordc':
                if (!$user->faculty->adordcDepartments->pluck('id')->contains($formInstance->student->department_id)) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
                break;

            case 'dordc':
                if ($user->current_role->role != 'dordc') {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            case 'dra':
                if ($user->current_role->role != 'dra') {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            case 'director':
                if ($user->current_role->role != 'director') {
                    throw new \Exception('You are not authorized to access this resource');
                }
                break;

            default:
                throw new \Exception('Invalid role for submission');
        }
    }

    private function getSubmissionMessage($role, $name)
    {
        return match ($role->role) {
            'student' => "$name (Student) submitted the form",
            'faculty' => "$name (Supervisor) submitted the form",
            'phd_coordinator' => "$name (PhD Coordinator) submitted the form",
            'hod' => "$name (HOD) submitted the form",
            'dordc' => "$name (DORDC) submitted the form",
            'dra' => "$name (DRA) submitted the form",
            'adordc' => "$name (ADORDC) submitted the form",
            'director' => "$name (Director) submitted the form",
            'external' => "$name (External) submitted the form",
            'doctoral' => "$name (Doctoral Committee) submitted the form",
            default => "$name submitted the form",
        };
    }

    private function getRejectionMessage($role, $name)
    {
        return match ($role->role) {
            'student' => "$name (Student) Rejected the form",
            'faculty' => "$name (Supervisor) Rejected the form",
            'phd_coordinator' => "$name (PhD Coordinator) Rejected the form",
            'external' => "$name (External) Rejected the form",
            'hod' => "$name (HOD) Rejected the form",
            'dordc' => "$name (DORDC) Rejected the form",
            'dra' => "$name (DRA) Rejected the form",
            'director' => "$name (Director) Rejected the form",
            'doctoral' => "$name (Doctoral Committee) Rejected the form",

            default => "$name Rejected the form",
        };
    }

    private function getFormType($model)
    {
        $model = (new \ReflectionClass($model))->getShortName();

        return match ($model) {
            'SupervisorAllocation' => 'supervisor-allocation',
            'SupervisorChangeForm' => 'supervisor-change',
            'StudentSemesterOffForm' => 'semester-off',
            'StudentStatusChangeForms' => 'status-change',
            'ConstituteOfIRB' => 'irb-constitution',
            'IrbSubForm' => 'irb-submission',
            'ResearchExtentionsForm' => 'irb-extension',
            'ThesisSubmission' => 'thesis-submission',
            'ThesisExtentionForm' => 'thesis-extension',
            'ListOfExaminersForm' => 'list-of-examiners',
            'SynopsisSubmission' => 'synopsis-submission',
            'Presentation' => 'presentation',
        };
    }

    private function updateForm($model, $student_id, $next)
    {
        if ($model === Presentation::class)
            return;
        $form = Forms::where('form_type', $this->getFormType($model))->where('student_id', $student_id)->first();
        if ($next == 'external') $next = 'doctoral';
        if ($next != 'complete') {
            $field = $next . '_available';
            $form->$field = true;
        }
        $form->stage = $next;
        $form->save();
    }
}
