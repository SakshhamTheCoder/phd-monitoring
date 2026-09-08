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
       return $this->listForms($user, SupervisorChangeForm::class,$request,null,false,[
        'fields' => [
            "name","roll_no","to_change","reason"
        ],
        'extra_fields' => [
            "to_change" => function ($form) {
                return $form->student->supervisors->map(function ($supervisor) {
                    return $supervisor->user->name();
                })->join(', ');
            },
        ],
        'titles' => [ "Name", "Roll No","To Change","Reason"],
    ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps=['student','phd_coordinator','hod','dordc','dra','complete'];
        
        if($role->role != 'student'){
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $data=[
            'roll_no'=>$user->student->roll_no,
            'steps'=>$steps,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(SupervisorChangeForm::class, $data,function ($formInstance) {
            $formInstance->current_supervisors = $formInstance->student->supervisors->pluck('faculty_code')->toArray();
            $formInstance->irb_submitted = $formInstance->student->irbSubForm?->completion=='complete'?true:false;
            if(!$formInstance->irb_submitted){
                $formInstance->steps=['student','phd_coordinator','hod','complete'];
            }
        });
    }

    public function loadForm(Request $request, $form_id = null)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $model = SupervisorChangeForm::class;
        $steps = [
            'student',
            'phd_coordinator',
            'hod',
            'dordc',
            'dra'
        ];
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model, $steps, function ($formInstance) {
                    $formInstance->current_supervisors = $formInstance->student->supervisors->pluck('faculty_code')->toArray();
                    $formInstance->irb_submitted = $formInstance->student->irbSubForm?->completion=='complete'?true:false;
                });
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            case 'dordc':
            case 'dra':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'director':
            case 'admin':
                return $this->handleAdminForm($user, $form_id, $model,true);
           
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    public function submit(Request $request, $form_id)
    {
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
            case 'dra':
                return $this->draSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;

        $allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director'];
        if (!in_array($role->role, $allowedRoles)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
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
                    throw new \Exception("Please select 3 unique prefrences");
                }
                $i = 1;
                foreach ($prefrences as $prefrence) {
                    if (!Faculty::find($prefrence)) {
                        throw new \Exception("Invalid prefrence selected");
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
        $model = SupervisorChangeForm::class;
        $form=SupervisorChangeForm::find($form_id);
        if(!$form->irb_submitted)
        {
            return $this->submitForm(
                $user,
                $request,
                $form_id,
                $model,
                'hod',
                'phd_coordinator',
                'complete',
                function ($formInstance) use ($request, $user) {
                    if ($request->approval) {
                        $to_change = $formInstance->to_change;
                        $new_supervisors = $formInstance->new_supervisors;
                        for($i=0;$i<count($to_change);$i++){
                            $supervisor=Faculty::find($to_change[$i]);
                            $new_supervisor=Faculty::find($new_supervisors[$i]);
                            $this->changeSupervisor($formInstance->student->roll_no,$supervisor,$new_supervisor);
                        }
                        $formInstance->completion='complete';
                        $formInstance->addHistoryEntry("Supervisors change request approved by HOD", $user->name());
                    }
                }
            );
        }
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'hod',
            'phd_coordinator',
            'dordc',
        );
       
    }

    
    private function draSubmit($user, $request, $form_id)
    {
        $model = SupervisorChangeForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'dra', 'dordc', 'complete',
        function ($formInstance) use ($request, $user) {
            if ($request->approval) {
                $to_change = $formInstance->to_change;
                $new_supervisors = $formInstance->new_supervisors;
                for($i=0;$i<count($to_change);$i++){
                    $supervisor=Faculty::find($to_change[$i]);
                    $new_supervisor=Faculty::find($new_supervisors[$i]);
                    $this->changeSupervisor($formInstance->student->roll_no,$supervisor,$new_supervisor);
                }
                $formInstance->completion='complete';
                $formInstance->addHistoryEntry("Supervisors change request approved by DRA", $user->name());
            }
        });
    }



    private function dordcSubmit($user, $request, $form_id)
    {
        $model = SupervisorChangeForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'dordc', 'hod', 'dra', function ($formInstance) use ($request, $user) {
        

        });
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
