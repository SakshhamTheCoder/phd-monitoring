<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\IrbSubForm;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Approval;
use App\Models\DoctoralCommittee;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\PHDObjective;
use App\Models\User;
use App\Services\EmailService;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

use function Laravel\Prompts\form;

class IrbSubController extends Controller
{
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use SaveFile;
    use GeneralFormCreate;
    use FilterLogicTrait;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }

    public function listForm(Request $request, $student_id=null)
    {
       $user = Auth::user();
       if($student_id)
         return $this->listFormsStudent($user, IrbSubForm::class, $student_id);
       return $this->listForms($user, IrbSubForm::class,$request,null,false,[
        'fields' => [
            "name","roll_no","date_of_irb","supervisors"
        ],
        'extra_fields' => [
            "supervisors" => function ($form) {
            return $form->student->supervisors->map(function ($supervisor) {
                return $supervisor->user->name();
            })->join(', ');
            },
            "date_of_irb" => function ($form) {
                return \Carbon\Carbon::parse($form->student->date_of_irb)->format('Y-m-d');
            },
        ],
        'titles' => [ "Name", "Roll No","Date of IRB","Supervisors"],
    ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps=['student','faculty','external','doctoral','hod','adordc','dordc','complete'];
        if($role->role != 'student'){
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $data=[
            'roll_no'=>$user->student->roll_no,
            'steps'=>$steps,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(IrbSubForm::class, $data);
    }


    public function loadForm(Request $request, $form_id=null)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $model = IrbSubForm::class;
        $steps=['student','faculty','external','doctoral','hod','adordc','dordc','complete'];
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model,$steps);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'doctoral':
                return $this->handleDoctoralForm($user, $form_id, $model);
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'adordc':
                return $this->handleAdordcForm($user, $form_id, $model);
            case 'faculty':
                return $this->handleFacultyForm($user, $form_id, $model);
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
            case 'faculty':
                return $this->supervisorSubmit($user, $request, $form_id);
            case 'doctoral':
                return $this->doctoralSubmit($user, $request, $form_id);
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'adordc':
                return $this->adordcSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $form_ids = $request->input('form_ids');
        $allowed_roles = ['hod', 'dordc','adordc'];
        if (!in_array($role->role, $allowed_roles)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $request->validate([
            'form_ids' => 'required|array',
        ]);
        $request->merge(['approval' => true]);
        foreach ($form_ids as $id) {
            $form = IrbSubForm::find($id);
            if (!$form) {
                return response()->json(['message' => 'Form not found'], 404);
            }
            if ($role->role == 'hod') {
                $this->hodSubmit($user, $request, $id);
            } elseif ($role->role == 'dordc') {
                $this->dordcSubmit($user, $request, $id);
            }
        }
        return response()->json(['message' => 'Forms submitted successfully'], 200);
    }

    private function studentSubmit($user, $request, $form_id)
    {
        $request->validate([
            'revised_phd_objectives' => 'required|array',
            'revised_phd_title' => 'required|string',
            'irb_pdf' => 'required|file|mimes:pdf|max:20480',
            'date_of_irb' => 'required|string',
        ]);

        $model = IrbSubForm::class;

        return $this->submitForm($user, $request, $form_id, $model,'student', 'student','faculty',
        function ($formInstance) use ($request, $user) {
        
            $link=$this->replaceUploadedFile($formInstance->revised_irb_pdf, $request->file('irb_pdf'), 'irb_sub_rev', $user->student->roll_no);
          
                $formInstance->revised_phd_title = $request->revised_phd_title;
                $formInstance->revised_irb_pdf = $link;
                $formInstance->date_of_irb = $request->date_of_irb;
                $formInstance->student->date_of_irb = $request->date_of_irb;
                $formInstance->student->save();
                $objectives = $request->revised_phd_objectives;
          
               
                $formInstance->student->objectives()->where('type', 'revised')->delete();
                foreach ($objectives as $objective) {
                   PHDObjective::create([
                        'student_id' => $formInstance->student->roll_no,
                        'objective' => $objective,
                        'type' => 'revised',
                    ]);
                }

            if($formInstance->supervisorApprovals())
            $formInstance->supervisorApprovals()->delete();
            
            $supervisors = $formInstance->student->supervisors;
            foreach ($supervisors as $supervisor) {
                $formInstance->supervisorApprovals()->create([
                    'supervisor_id' => $supervisor->faculty_code,
                    'status' => 'awaited',
                ]);
            }

        });
    }

    private function supervisorSubmit($user, $request, $form_id)
    {
        $model = IrbSubForm::class;
        $form=IrbSubForm::find($form_id);
        return $this->submitForm($user, $request, $form_id, $model, 'faculty', 'student', 'external',
        function ($formInstance) use ($request, $user) {
            $this->handleSupervisorSubmitForm($user, $request, $formInstance);
        });
    }   

    private function doctoralSubmit($user, $request, $form_id)
    {
        $model = IrbSubForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'doctoral', 'faculty', 'hod',  function ($formInstance) use ($request, $user) {
            $this->handleDoctoralSubmitForm($user, $request, $formInstance);
        });
    }
    
     private function adordcSubmit($user, $request, $form_id)
    {
        $model = IrbSubForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'adordc', 'hod', 'dordc');
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $model = IrbSubForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'hod', 'faculty', 'adordc');
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        $model = IrbSubForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'dordc', 'phd_coordinator', 'complete', function ($formInstance) use ($request, $user) {
            $student = $formInstance->student;
            $student->phd_title=$formInstance->revised_phd_title;
            $student->save();
               $formInstance->completion='complete';
               $formInstance->status='approved';
               $forms = [
                [
                    'form_type' => 'synopsis-submission',
                    'form_name' => 'Synopsis Submission',
                    'max_count' => 1,
                    'stage' => 'student',
                ],
                [
                    'form_type' => 'thesis-extension',
                    'form_name' => 'Thesis Extension',
                    'max_count' => 10,
                    'stage' => 'student',
                ],
                [
                    'form_type' => 'thesis-submission',
                    'form_name' => 'Thesis Submission',
                    'max_count' => 1,
                    'stage' => 'student',
                ]
            ];
            // $student = $formInstance->student;
            foreach ($forms as $form) {
                $existingForm = Forms::where('student_id', $student->roll_no)
                    ->where('form_type', $form['form_type'])
                    ->first();

                if (!$existingForm) {
                    $formData = app(\App\Http\Controllers\AdminFormController::class)->getFormCreationData(
                        $form['form_type'],
                        $student->roll_no,
                        $student->department_id
                    );
                    
                    if ($formData) {
                        Forms::create($formData);
                    }
                }
                
            
            }

        });
    }

    private function handleSupervisorSubmitForm($user, $request, $formInstance)
    {
        $faculty_code = $user->faculty->faculty_code;
        if($request->approval){
            
            if($formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->first()->status=='approved'){
                throw new \Exception('You have already approved the form, Can Only Submit once all the supervisors approve');
            }            
                $request->validate([
                    'supervised_outside' => 'required|integer',
                ]);
                $faculty=$user->faculty;
                $faculty->supervised_outside=$request->supervised_outside;
                // supervised_campus is now computed live via the Faculty accessor,
                // so we only persist the manually-entered outside count here.
                $faculty->save();
            
            $formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->update([
              'status' => 'approved',
            ]);
            
            $formInstance->addHistoryEntry("Supervisor Approved The Form", $user->name());
    
            $approvals=$formInstance->supervisorApprovals()->where('status','approved')->get();
           
            if($approvals->count()!=$formInstance->student->supervisors->count()){
                throw new \Exception('Your Prefrences Saved, Form Will be submitted once all Supervisors approve',201);
            }
            else{
                // Email the outside expert a secure, single-use link to the review page.
                $formInstance->sendExternalReviewRequest();
            }
        }
        else{
            $formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->update([
              'status' => 'rejected',
            ]);
        }
    }

     private function handleDoctoralSubmitForm($user, $request, $formInstance)
    {
        $faculty_code = $user->faculty->faculty_code;
        if($request->approval){
            
            if($formInstance->doctoralApprovals()->where('doctoral_id', $faculty_code)->first()->status=='approved'){
                throw new \Exception('You have already approved the form, Can Only Submit once all the supervisors approve');
            }            
                           
            $formInstance->doctoralApprovals()->where('doctoral_id', $faculty_code)->update([
              'status' => 'approved',
            ]);
            
            $formInstance->addHistoryEntry("Doctoral Member Approved The Form", $user->name());
    
            $approvals=$formInstance->doctoralApprovals()->where('status','approved')->get();
           
            if($approvals->count()!=$formInstance->student->doctoralCommittee->count()){
                throw new \Exception('Your Prefrences Saved, Form Will be submitted once all Members from IRB Committee approve',201);
            }
        
        }
        else{
            $formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->update([
              'status' => 'rejected',
            ]);
        }
    }
}