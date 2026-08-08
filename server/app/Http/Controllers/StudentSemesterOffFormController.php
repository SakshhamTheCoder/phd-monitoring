<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use Illuminate\Http\Request;

use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Http\Controllers\Traits\HasSemesterCodeValidation;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\Semester;
use App\Models\StudentSemesterOff;
use App\Models\StudentSemesterOffForm;
use App\Models\ThesisSubmission;


class StudentSemesterOffFormController extends Controller
{
    
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use SaveFile;
    use GeneralFormCreate;
    use FilterLogicTrait;
    use HasSemesterCodeValidation;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }
    public function listForm(Request $request, $student_id=null)
    {
       $user = Auth::user();
       if($student_id)
         return $this->listFormsStudent($user, StudentSemesterOffForm::class, $student_id);
       return $this->listForms($user, StudentSemesterOffForm::class,$request,null,false,[
        'fields' => [
            "name","roll_no","reason","semester_off_required"
        ],
        'extra_fields' => [
            "semester_off_required" => function ($form) {
                return $form->semester_off_required;
            },
        ],
        'titles' => [ "Name", "Roll No","Reason","Semester Off Required"],
    ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps=['student','faculty','phd_coordinator','hod','dra','dordc','director','complete'];
        if($role->role != 'student'){
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $data=[
            'roll_no'=>$user->student->roll_no,
            'steps'=>$steps,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(StudentSemesterOffForm::class, $data);
    }

    
    public function loadForm(Request $request, $form_id=null)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $model = StudentSemesterOffForm::class;
        $steps=['student','faculty','phd_coordinator','hod','dra','dordc','director'];
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
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'dra':
                return $this->draSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'phd_coordinator':
                return $this->coordinatorSubmit($user, $request, $form_id);
            case 'director':
                return $this->directorSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }


    private function studentSubmit($user, $request, $form_id)
    {
        $model = StudentSemesterOffForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'student',
            'student',
            'faculty',
            function ($formInstance) use ($request, $user) {
                $request->validate([
                   'reason' => 'required|string',
                   'semester_off_required' => 'required|string',
                   'proof_pdf' => 'file|mimes:pdf|max:20480',
                ]);
                $prev_semester_off=StudentSemesterOff::where('student_id',$user->student->roll_no);
                if ($prev_semester_off->count() > 0) {
                    $request->validate([
                        'previous_approval_pdf' => 'required|file|mimes:pdf|max:20480',
                    ]);
                    if($request->hasFile('previous_approval_pdf')){
                        $link=$this->replaceUploadedFile($formInstance->previous_approval_pdf, $request->file('previous_approval_pdf'), 'semester_off', $user->student->roll_no);
                        $formInstance->previous_approval_pdf = $link;
                    }
                }
                $validator=$this->validateSemesterCode($request->semester_off_required);
                if(!$validator['valid']){
                    return response()->json(['message' => 'Invalid semester code'], 422);
                }
                if($validator['in_db']){
                    $formInstance->semester_id=$validator['semester_id'];
                }
                else{
                    $semester = Semester::createOrUpdateFromCode($request->semester_off_required);
                    $formInstance->semester_id=$semester->id;
                }
                $formInstance->reason = $request->reason;
                $formInstance->semester_off_required = $request->semester_off_required;

                if($request->hasFile('proof_pdf')){
                    $link=$this->replaceUploadedFile($formInstance->proof_pdf, $request->file('proof_pdf'), 'semester_off', $user->student->roll_no);
                    $formInstance->proof_pdf = $link;
                }
             
            }
        );
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $form_ids = $request->input('form_ids', []);
        $allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director'];
        if (!in_array($role->role, $allowedRoles)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        if (empty($form_ids)) {
            return response()->json(['message' => 'No form IDs provided'], 400);
        }
        foreach ($form_ids as $form_id) {
            $this->submit($request, $form_id);
        }
        $request->merge(['approval' => true]);
        return response()->json(['message' => 'Forms submitted successfully'], 200);
    }
    private function supervisorSubmit($user, $request, $form_id)
    {
        $model = StudentSemesterOffForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'faculty',
            'student',
            'phd_coordinator',
        );
    }

    private function coordinatorSubmit($user, $request, $form_id)
    {
        $model = StudentSemesterOffForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'phd_coordinator',
            'faculty',
            'hod',
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $model = StudentSemesterOffForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'hod',
            'phd_coordinator',
            'dra',
        );
    }

    private function draSubmit($user, $request, $form_id)
    {
        $model = StudentSemesterOffForm::class;
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
        $model = StudentSemesterOffForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'dordc',
            'dra',
            'director',
        );
    }

    private function directorSubmit($user, $request, $form_id)
    {
        $model = StudentSemesterOffForm::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'director',
            'dordc',
            'complete',
            function ($formInstance) use ($request, $user) {
                if ($request->approval) {
                    $formInstance->completion='complete';
                    $formInstance->status = 'approved';
                    $studentSemesterOff = new StudentSemesterOff();
                    $studentSemesterOff->student_id = $formInstance->student_id;
                    $studentSemesterOff->semester_id = $formInstance->semester_id;
                    $studentSemesterOff->reason = $formInstance->reason;
                    $studentSemesterOff->semester_off_required = $formInstance->semester_off_required;
                    $studentSemesterOff->proof_pdf = $formInstance->proof_pdf;
                    $studentSemesterOff->save();
                    $formInstance->addHistoryEntry("Semester Off approved by Director", $user->name());
                }

            }
        );
    }
}
