<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\ResearchExtentionsForm;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;


class ResearchExtentionController extends Controller
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
         return $this->listFormsStudent($user, ResearchExtentionsForm::class, $student_id);
       return $this->listForms($user, ResearchExtentionsForm::class,$request,null,false,[
        'fields' => [
            "name","roll_no","date_of_synopsis","supervisors"
        ],
        'extra_fields' => [
            "supervisors" => function ($form) {
            return $form->student->supervisors->map(function ($supervisor) {
                return $supervisor->user->name();
            })->join(', ');
            },
            "date_of_synopsis" => function ($form) {
                return \Carbon\Carbon::parse($form->student->date_of_synopsis)->format('Y-m-d');
            },
        ],
        'titles' => [ "Name", "Roll No","Date of Synopsis","Supervisors"],
    ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps=[
            'student',
            'faculty',
            'phd_coordinator',
            'hod',
            'dra',
            'dordc',
            'complete'
        ];
        if($role->role != 'student'){
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $changes=$user->student->researchExtentions();
        if($changes->count()>0){
            $steps=[
                'student',
                'faculty',
                'phd_coordinator',
                'hod',
                'dra',
                'dordc',
                'director',
                'complete'
            ];
        }
        $data=[
            'roll_no'=>$user->student->roll_no,
            'steps'=>$steps,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(ResearchExtentionsForm::class, $data);
    }

    public function loadForm(Request $request, $form_id=null)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $model = ResearchExtentionsForm::class;
        $steps=[
            'student',
            'faculty',
            'phd_coordinator',
            'hod',
            'dra',
            'dordc',
            'director'
        ];
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model,$steps);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            case 'dra':
            case 'dordc':
            case 'director':
                return $this->handleAdminForm($user, $form_id, $model);
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
            case 'phd_coordinator':
                return $this->coordinatorSubmit($user, $request, $form_id);
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'dra':
                return $this->draSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'director':
                return $this->directorSubmit($user, $request, $form_id);
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
            'form_ids.*' => 'exists:research_extentions_forms,id',
        ]);
        $request->merge(['approval' => true]);
        foreach ($request->form_ids as $form_id) {
            $this->submit($request, $form_id);
        }
        return response()->json(['message' => 'Forms submitted successfully'], 200);
    }

    private function studentSubmit($user,$request,$form_id){
        $model = ResearchExtentionsForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'student', 'student', 'faculty',
        function ($formInstance) use ($request, $user) {
            $request->validate([
                'reason' => 'required|string',
                'duration' => 'integer',
                'research_pdf' => 'required|file|mimes:pdf|max:20480',
            ]);
            $formInstance->reason = $request->reason;
            if($request->has('duration')){
                $formInstance->duration = $request->duration;
            }
            $filePath=$this->saveUploadedFile($request->file('research_pdf'), 'research_extentions', $user->student->roll_no);
            $formInstance->research_pdf = $filePath;
        });
    }

    private function supervisorSubmit($user, $request, $form_id)
    {
        $model = ResearchExtentionsForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'faculty', 'student', 'phd_coordinator');
    }

    private function coordinatorSubmit($user, $request, $form_id)
    {
        $model = ResearchExtentionsForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'phd_coordinator', 'faculty', 'hod');
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $model = ResearchExtentionsForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'hod', 'phd_coordinator', 'dra');
    }

    private function draSubmit($user, $request, $form_id)
    {
        $model = ResearchExtentionsForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'dra', 'hod', 'dordc');
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        $model = ResearchExtentionsForm::class;
        $form=ResearchExtentionsForm::find($form_id);
        $prevExtentions=$form->student->researchExtentions();
        if($prevExtentions->count()==0)
        return $this->submitForm($user, $request, $form_id, $model, 'dordc', 'dra', 'complete',
        function ($formInstance) use ($request, $user) {
            $formInstance->status='approved';
            $formInstance->student->researchExtentions()->create([
                'period_of_extension'=>$formInstance->period_of_extention,
                'research_pdf'=>$formInstance->research_pdf,
                'reason'=>$formInstance->reason,
                'research_extentions_id'=>$formInstance->id,
                
            ]);
            $formInstance->addHistoryEntry('Form Approved by DORDC', $user->name());
        });
        else
        return $this->submitForm($user, $request, $form_id, $model, 'dordc', 'dra', 'director');
    }

    private function directorSubmit($user, $request, $form_id)
    {
        $model = ResearchExtentionsForm::class;
        return $this->submitForm($user, $request, $form_id, $model, 'director', 'dordc', 'complete',
        function ($formInstance) use ($request, $user) {
            $formInstance->status='approved';
            $formInstance->student->researchExtentions()->create([
                'period_of_extension'=>$formInstance->period_of_extention,
                'research_pdf'=>$formInstance->research_pdf,
                'reason'=>$formInstance->reason,
                'research_extentions_id'=>$formInstance->id
            ]);
            $formInstance->addHistoryEntry('Form Approved by Director', $user->name());
        });
    }

}