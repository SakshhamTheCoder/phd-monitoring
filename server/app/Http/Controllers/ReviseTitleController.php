<?php

namespace App\Http\Controllers;

use App\Forms\ReviseTitleDefinition;
use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Models\PHDObjective;
use App\Models\ReviseTitleForm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * A scholar asks to change their PhD title and objectives.
 *
 * The chain is the synopsis's first round, which is what this form ran on while
 * it was served by the synopsis controller. There is no viva, so no second
 * round: the DORDC's approval completes it.
 */
class ReviseTitleController extends Controller
{
    /** Who may approve several of these at once; the list page offers it to the same. */
    public const BULK_APPROVERS = ['hod', 'phd_coordinator', 'dordc'];

    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use GeneralFormCreate;
    use FilterLogicTrait;

    private const STEPS = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc', 'complete'];

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("forms"));
    }

    // Also mounted under /students/{id}/forms, where the scholar's page lists
    // only their forms.
    public function listForm(Request $request, $student_id = null)
    {
        $user = Auth::user();
        if ($student_id) {
            return $this->listFormsStudent($user, ReviseTitleForm::class, $student_id);
        }
        return $this->listForms($user, ReviseTitleForm::class, $request, null, false, [
            'fields' => ["name", "roll_no", "revised_title"],
            'titles' => ["Name", "Roll No", "Revised Title"],
        ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        if ($role->role != 'student') {
            return $this->refuse();
        }

        return $this->createForms(ReviseTitleForm::class, [
            'roll_no' => $user->student->roll_no,
            'steps' => self::STEPS,
            'role' => $role->role,
            'name' => $user->first_name . ' ' . $user->last_name,
        ]);
    }

    /**
     * The step this user is acting as. Same rule as the synopsis: a committee
     * member signs in holding 'faculty', and only that role is mapped, since a
     * HOD or coordinator on the committee holds their own step here.
     */
    private function actingStep($user, $form_id): string
    {
        $role = $user->current_role->role;
        if ($role !== 'faculty') {
            return $role;
        }

        $form = ReviseTitleForm::find($form_id);

        $code = $user->faculty?->faculty_code;

        if (!$form || !$form->student->checkDoctoralCommittee($code)) {

            return $role;

        }

        // A supervisor who also sits on the committee answers as supervisor until

        // the form reaches the committee; otherwise the supervisor step could

        // never be answered by them.

        return $form->student->checkSupervises($code) && $form->stage !== 'doctoral' ? $role : 'doctoral';
    }

    public function loadForm(Request $request, $form_id = null)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $model = ReviseTitleForm::class;
        switch ($this->actingStep($user, $form_id)) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model);
            case 'faculty':
                return $this->handleFacultyForm($user, $form_id, $model);
            case 'doctoral':
                return $this->handleDoctoralForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            // Reads the form, answers nothing. Not a step in the chain.
            case 'adordc':
                return $this->handleAdordcForm($user, $form_id, $model);
            // Neither holds a step here; GeneralFormList lists the director
            // every form whose chain does not name them.
            case 'director':
            case 'admin':
                return $this->handleAdminForm($user, $form_id, $model, true);
            default:
                return $this->refuse();
        }
    }

    public function submit(Request $request, $form_id)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        switch ($this->actingStep($user, $form_id)) {
            case 'student':
                return $this->studentSubmit($user, $request, $form_id);
            case 'faculty':
                return $this->submitForm($user, $request, $form_id, ReviseTitleForm::class, 'faculty', 'student', 'doctoral');
            case 'doctoral':
                return $this->submitForm($user, $request, $form_id, ReviseTitleForm::class, 'doctoral', 'faculty', 'phd_coordinator');
            case 'phd_coordinator':
                return $this->submitForm($user, $request, $form_id, ReviseTitleForm::class, 'phd_coordinator', 'doctoral', 'hod');
            case 'hod':
                return $this->submitForm($user, $request, $form_id, ReviseTitleForm::class, 'hod', 'phd_coordinator', 'dordc');
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            default:
                return $this->refuse();
        }
    }

    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        if (!in_array($user->current_role->role, self::BULK_APPROVERS, true)) {
            return $this->refuse();
        }
        $request->validate([
            'form_ids' => 'required|array',
            'approval' => 'required|boolean',
        ]);
        $request->merge(['approval' => true]);
        return $this->bulkResults($request->form_ids, fn ($form_id) => $this->submit($request, $form_id));
    }

    private function studentSubmit($user, $request, $form_id)
    {
        return $this->submitForm(
            $user, $request, $form_id, ReviseTitleForm::class,
            'student',
            'student',
            'faculty',
            function ($formInstance) use ($request) {
                $request->validate((new ReviseTitleDefinition)->rules('student'));
                $formInstance->revised_title = trim($request->revised_title);
                $formInstance->revised_objectives = array_values(array_map('trim', $request->revised_objectives));
            }
        );
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        return $this->submitForm(
            $user, $request, $form_id, ReviseTitleForm::class,
            'dordc',
            'hod',
            'complete',
            // Only reached on an approval: submitForm sends a rejection back
            // before it runs this.
            function ($formInstance, $user) {
                $this->applyRevision($formInstance, $user);
            }
        );
    }

    /**
     * The scholar's record changes only here, at completion. Title and
     * objectives go together or not at all, so a failure cannot leave a new
     * title beside the old objectives.
     */
    private function applyRevision($formInstance, $user): void
    {
        DB::transaction(function () use ($formInstance) {
            $student = $formInstance->student;
            $student->phd_title = $formInstance->revised_title;
            $student->save();

            $student->objectives()->where('type', 'revised')->delete();
            foreach ($formInstance->revised_objectives ?? [] as $objective) {
                PHDObjective::create([
                    'student_id' => $student->roll_no,
                    'objective' => $objective,
                    'type' => 'revised',
                ]);
            }

            $formInstance->completion = 'complete';
            $formInstance->status = 'approved';
            $formInstance->save();
        });

        $formInstance->addHistoryEntry('Revised title and objectives recorded on the scholar\'s profile', $user->name());
    }
}
