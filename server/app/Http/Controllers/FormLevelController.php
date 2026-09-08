<?php

namespace App\Http\Controllers;

use App\Models\ConstituteOfIRB;
use App\Models\Forms;
use App\Models\IrbSubForm;
use App\Models\ListOfExaminersForm;
use App\Models\Presentation;
use App\Models\ResearchExtentionsForm;
use App\Models\StudentSemesterOffForm;
use App\Models\StudentStatusChangeForms;
use App\Models\SupervisorAllocation;
use App\Models\SupervisorChangeForm;
use App\Models\SynopsisSubmission;
use App\Models\ThesisExtentionForm;
use App\Models\ThesisSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class FormLevelController extends Controller
{
    public function updateFormLevel(Request $request){
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_manage_form_levels')){
            return response()->json([
                'message' => 'You do not have permission to create supervisor'
            ], 403);
        }
        $request->validate([
            'form_type' => 'required|string',
            'form_id' => 'required|integer',
            'roll_no' => 'required|integer',
            'role' => 'required|string',
        ]);
        $modal= $this->getModal($request->form_type);
        if($request->form_type == 'presentation'){
            $form = Presentation::where('id', $request->form_id)->first();
            if(!$form){
                return response()->json(['message' => 'Form not found'], 404);
            }
            $this->setRole($form, $request->role);


        }else{
            $form= $modal::where('id', $request->form_id)->first();
            if(!$form){
                return response()->json(['message' => 'Form not found'], 404);
            }
            $this->setRole($form, $request->role);
            $formBase=Forms::where('form_type', $request->form_type)
                 ->where('student_id', $request->roll_no);
                 if($formBase->exists()){
                    $formType=$formBase->first();
                    $this->setAvailable($formType, $request->role);
                    $formType->save();
                 }       
             }
        return response()->json(['message' => 'Form level updated successfully'], 200);
    }
    private function setAvailable($formType,$role){
      $formType->stage=$role;
        switch ($role) {
            case 'student':
                $formType->student_available = false;
                break;
            case 'phd_coordinator':
                $formType->phd_coordinator_available = false;
                break;
            case 'external':
                $formType->external_available = false;
                break;
            case 'dra':
                $formType->dra_available = false;
                break;
            case 'dordc':
                $formType->dordc_available = false;
                break;
            case 'director':
                $formType->director_available = false;
                break;
            case 'hod':
                $formType->hod_available = false;
                break;
            case 'supervisor':
                $formType->supervisor_available = false;
                break;
            case 'doctoral':
                $formType->doctoral_available = false;
                break;
            default:
                break;
        }
        $formType->save();
    }
    private function getModal($formType){
        switch($formType){
            case 'supervisor-allocation':
                return SupervisorAllocation::class;
            case 'irb-submission':
                return IrbSubForm::class;
            case 'irb-constitution':
                return ConstituteOfIRB::class;
            case 'synopsis-submission':
                return SynopsisSubmission::class;
            case 'list-of-examiners':
                return ListOfExaminersForm::class;
            case 'thesis-submission':
                return ThesisSubmission::class;
            case 'status-change':
                return StudentStatusChangeForms::class;
            case 'semester-off':
                return StudentSemesterOffForm::class;
            case 'irb-extension':
                return ResearchExtentionsForm::class;
            case 'supervisor-change':
                return SupervisorChangeForm::class;
            case 'thesis-extension':
                return ThesisExtentionForm::class;
            case 'presentation':
                return Presentation::class;
            default:
                throw new \Exception("Invalid form type");
        }
    }
    private function setRole($formType, $role)
    {
        $steps= $formType->steps;
        if($steps){
            $index = array_search($role, $steps);
            $formType->current_step = $index;
            $formType->maximum_step = $index > $formType->maximum_step ? $index : $formType->maximum_step;
            $formType->stage=$role;
        }
        
        switch ($role) {
            case 'student':
                $formType->student_lock = false;
                break;
            case 'phd_coordinator':
                $formType->phd_coordinator_lock = false;
                break;
            case 'external':
                $formType->external_lock = false;
                break;
            case 'dra':
                $formType->dra_lock = false;
                break;
            case 'dordc':
                $formType->dordc_lock = false;
                break;
            case 'director':
                $formType->director_lock = false;
                break;
            case 'hod':
                $formType->hod_lock = false;
                break;
            case 'supervisor':
                $formType->supervisor_lock = false;
                break;
            case 'doctoral':
                $formType->doctoral_lock = false;
                break;
            default:
                break;
        }
        $formType->save();
    }
    public function listForms(Request $request){
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_manage_form_levels')){
            return response()->json([
                'message' => 'You do not have permission to create supervisor'
            ], 403);
        }
        $request->validate([
            'roll_no' => 'required|integer',
        ]);
        $ret=[];
        $forms=Forms::where('student_id', $request->roll_no)->get();
        foreach($forms as $form){
            $modal = $this->getModal($form->form_type);
            $formk= $modal::where('student_id', $request->roll_no)->get();
            if($form){
                $ret[]=[
                    'form_type'=>$form->form_type,
                    'form_name'=>$form->form_name,
                    'form_id'=>$formk->id,
                    'roll_no'=>$formk->student_id,
                    'status'=>$formk->status,
                    'current_step'=>$formk->current_step,
                    'maximum_step'=>$formk->maximum_step,
                    'stage'=>$formk->stage,
                    'created_at'=>$formk->created_at,
                    'count'=>$form->count,
                    'maximum_count'=>$form->max_count,
                    'steps'=> $form->steps,
                ];
            }
        }
        return response()->json(['forms' => $forms], 200);
    }
}
