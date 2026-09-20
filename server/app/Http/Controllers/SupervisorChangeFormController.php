<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
// use App\Models\IrbSubForm;
use App\Models\Faculty;
use App\Models\Student;
use App\Models\Supervisor;
// use App\Models\SupervisorAllocation;
use App\Models\SupervisorChangeForm;

class SupervisorChangeFormController extends Controller {
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use GeneralFormCreate;
    use FilterLogicTrait;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }
    public function listForm(Request $request, $student_id=null)
    {
       $user = Auth::user();
       if($student_id)
         return $this->listFormsStudent($user, SupervisorChangeForm::class, $student_id);

       // Reason is often personal; only the scholar, HOD and admin get it
       // (same capability ClerkController uses for leave reasons). Without
       // this the supervisor being replaced could read why.
       $canReadReason = $user->may('can_read_leave_reason');
       return $this->listForms($user, SupervisorChangeForm::class,$request,null,false,[
        'fields' => array_merge(
            ["name","roll_no","to_change"],
            $canReadReason ? ["reason"] : []
        ),
        'extra_fields' => array_merge(
            [
                "to_change" => function ($form) {
                    return $form->student->supervisors->map(function ($supervisor) {
                        return $supervisor->user->name();
                    })->join(', ');
                },
            ],
            $canReadReason ? ["reason"] : []
        ),
        'titles' => array_merge(
            ["Name", "Roll No","To Change"],
            $canReadReason ? ["Reason"] : []
        ),
    ]);
    }

    /**
     * Two chains, picked by how many supervisors the scholar has.
     *
     * Three or more supervisors is beyond the DORDC, so the form carries on to
     * the Vice Chancellor. Every earlier step is the same in both.
     */
    private const CHAIN = ['student', 'phd_coordinator', 'hod', 'dordc', 'complete'];
    private const CHAIN_ABOVE_TWO_SUPERVISORS = ['student', 'phd_coordinator', 'hod', 'dordc', 'director', 'complete'];

    /**
     * Raise a supervisor change.
     *
     * Only once the IRB has been constituted. Before that there is nothing to
     * disturb, so the HOD or the PhD coordinator changes the supervisor
     * outright from the scholar's page (SupervisorDoctoralChangeController::
     * proposeChange) and no form is raised at all.
     *
     * A coordinator may start the form on a scholar's behalf, naming them with
     * roll_no. It is the same form either way: it opens at the student's step,
     * because the preferences and the reason are theirs to give.
     */
    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;

        if ($role->role === 'student') {
            $student = $user->student;
        } elseif ($role->role === 'phd_coordinator') {
            $request->validate(['roll_no' => 'required|integer|exists:students,roll_no']);
            $student = Student::where('roll_no', $request->roll_no)->first();
            if ($student->department_id !== $user->faculty->department_id) {
                return response()->json(['message' => 'You can only raise this for a scholar in your own department'], 403);
            }
        } else {
            return $this->refuse();
        }

        if (!$student->irbCompleted()) {
            return response()->json([
                'message' => 'The IRB for this scholar has not been constituted yet, so no form is needed. '
                    . 'The HOD or the PhD coordinator can change the supervisor from the scholar page.',
            ], 400);
        }

        $data=[
            'roll_no'=>$student->roll_no,
            'steps'=>count($student->supervisors) > 2 ? self::CHAIN_ABOVE_TWO_SUPERVISORS : self::CHAIN,
            // The step the form opens at, which is the scholar's whoever raised it.
            'role'=>'student',
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(SupervisorChangeForm::class, $data,function ($formInstance) {
            $formInstance->current_supervisors = $formInstance->student->supervisors->pluck('faculty_code')->toArray();
            $formInstance->irb_submitted = $formInstance->student->irbSubForm?->completion=='complete'?true:false;
        });
    }

    public function loadForm(Request $request, $form_id = null)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        $model = SupervisorChangeForm::class;
        switch ($role->role) {
            case 'student':
                // current_supervisors and irb_submitted are columns, written by
                // createForm and read back by fullForm. This call used to pass a
                // closure recomputing both, which handleStudentForm never ran.
                return $this->handleStudentForm($user, $form_id, $model);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            // Reads the form, answers nothing. Not a step in the chain.
            case 'adordc':
                return $this->handleAdordcForm($user, $form_id, $model);
            case 'director':
            case 'admin':
                return $this->handleAdminForm($user, $form_id, $model,true);
           
            default:
                return $this->refuse();
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
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'phd_coordinator':
                return $this->coordinatorSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'director':
                return $this->directorSubmit($user, $request, $form_id);
            default:
                return $this->refuse();
        }
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;

        $allowedRoles = ['hod', 'phd_coordinator', 'dordc', 'director'];
        if (!in_array($role->role, $allowedRoles)) {
            return $this->refuse();
        }
        $request->validate([
            'form_ids' => 'required|array',
            'approval' => 'required|boolean',
        ]);
        foreach ($request->form_ids as $form_id) {
            $this->submit($request, $form_id);
        }
        $request->merge(['approval' => true]);
        return response()->json(['message' => 'Forms submitted successfully'], 200);
    }
    
    private function studentSubmit($user, $request, $form_id)
    {
        $model = SupervisorChangeForm::class;

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'student',
            'student',
            'phd_coordinator',
            function ($formInstance) use ($request, $user) {
                $request->validate([
                    'prefrences' => 'required|array',
                    'to_change'=>'required|array',
                    'reason'=>'required|string'
                ]);
                $to_change = $request->to_change;
                $reason = $request->reason;

                $prefrences = $request->prefrences;
                if (count($prefrences) != 3 || count(array_unique($prefrences)) != 3) {
                    throw new \Exception("Please choose three different supervisors.");
                }
                $i = 1;
                foreach ($prefrences as $prefrence) {
                    if (!Faculty::find($prefrence)) {
                        throw new \Exception("One of the chosen supervisors is not in the faculty list.");
                    }
                }
                foreach($to_change as $supervisor){
                    if(!Faculty::find($supervisor)){
                        throw new \Exception("Invalid supervisor selection");
                    }
                    if(!$formInstance->student->checkSupervises($supervisor)){
                        throw new \Exception("The faculty does not supervise the student");
                    }
                }
              
                $formInstance->prefrences = $prefrences;
                $formInstance->reason=$reason;
                $formInstance->to_change=$to_change;
              
            }
        );
    }
    private function coordinatorSubmit($user, $request, $form_id)
    {
        $model = SupervisorChangeForm::class;
      
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'phd_coordinator',
            'student',
            'hod',
            function ($formInstance) use ($request, $user) {
                $request->validate([
                    'new_supervisors' => 'required|array',
                ]);
                $supervisors = $request->new_supervisors;
                if(count($supervisors)!=count($formInstance->to_change)){
                    throw new \Exception("Number of supervisors to change and new supervisors should be same");
                }
                foreach ($supervisors as $supervisor) {
                    if (!Faculty::find($supervisor)) {
                        throw new \Exception("Invalid supervisor selected");
                    }
                    if($formInstance->student->checkSupervises($supervisor)){
                        throw new \Exception("The faculty already supervises the student");
                    }
                }
                $formInstance->new_supervisors = $supervisors;
            }
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            SupervisorChangeForm::class,
            'hod',
            'phd_coordinator',
            'dordc'
        );
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        $form = SupervisorChangeForm::find($form_id);
        if (!$form) {
            return response()->json(['message' => 'No form found'], 404);
        }

        // Three or more supervisors goes on to the Vice Chancellor, so the
        // DORDC is not always the last word.
        $next = in_array('director', $form->steps ?? [], true) ? 'director' : 'complete';

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            SupervisorChangeForm::class,
            'dordc',
            'hod',
            $next,
            function ($formInstance) use ($request, $user, $next) {
                if ($request->approval && $next === 'complete') {
                    $this->applyChange($formInstance, $user, 'DORDC');
                }
            }
        );
    }

    private function directorSubmit($user, $request, $form_id)
    {
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            SupervisorChangeForm::class,
            'director',
            'dordc',
            'complete',
            function ($formInstance) use ($request, $user) {
                if ($request->approval) {
                    $this->applyChange($formInstance, $user, 'Vice Chancellor');
                }
            }
        );
    }

    /** Swap the supervisors over. Run by whoever holds the last step. */
    private function applyChange($formInstance, $user, string $approvedBy)
    {
        $to_change = $formInstance->to_change;
        $new_supervisors = $formInstance->new_supervisors;
        for ($i = 0; $i < count($to_change); $i++) {
            $supervisor = Faculty::find($to_change[$i]);
            $new_supervisor = Faculty::find($new_supervisors[$i]);
            $this->changeSupervisor($formInstance->student->roll_no, $supervisor, $new_supervisor);
        }
        $formInstance->completion = 'complete';
        $formInstance->addHistoryEntry("Supervisors change request approved by {$approvedBy}", $user->name());
    }

    private function changeSupervisor($student_id,$supervisor,$new_supervisor)
    {
        $supervisor=Supervisor::where('student_id',$student_id)->where('faculty_id',$supervisor->faculty_code)->first();
        if(!$supervisor){
            throw new \Exception("The faculty does not supervise the student");
        }
        $supervisor->faculty_id=$new_supervisor->faculty_code;
        $supervisor->save();       
    }

}
