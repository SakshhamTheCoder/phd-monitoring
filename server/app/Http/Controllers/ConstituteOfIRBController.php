<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Models\ConstituteOfIRB;
use App\Models\DoctoralCommittee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IrbExpertChairman;
use App\Models\IrbNomineeCognate;
use App\Models\IrbOutsideExpert;
use App\Models\OutsideExpert;
use App\Models\Role;
use App\Models\User;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Department;
use App\Models\IRBCommittee;
use App\Models\PHDObjective;

//TODO: add outside expert not in the system


class ConstituteOfIRBController extends Controller
{
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use GeneralFormCreate;
    use SaveFile;
    use FilterLogicTrait;

    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }
    public function listForm(Request $request, $student_id=null)
    {
       $user = Auth::user();
       if($student_id)
         return $this->listFormsStudent($user, ConstituteOfIRB::class, $student_id);
       return $this->listForms($user, ConstituteOfIRB::class,$request,null,false,[
        'fields' => [
            "name","roll_no", "email","supervisors"
        ],
        'extra_fields' => [
            "email" => function ($form) {
            return $form->student->user->email;
            },
            "semester" => function ($form) {
            return $form->id;
            },
            "supervisors" => function ($form) {
            return $form->student->supervisors->map(function ($supervisor) {
                return $supervisor->user->name();
            })->join(', ');
            },
            'broad_area_of_research' => function ($form) {
                $area = $form->student->areaOfSpecialization;
                return $area ? $area->name : null;
            },
        ],
        'titles' => [ "Name", "Roll No",  "Email","Supervisors","Broad Area of Research"],
    ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps = [
            'student',
            'faculty',
            'hod',
            'adordc',
            'dordc',
            'complete'
        ];
        if($role->role != 'student'){
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $data=[
            'roll_no'=>$user->student->roll_no,
            'steps'=>$steps,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(ConstituteOfIRB::class, $data);
    }

    public function loadForm(Request $request, $form_id=null)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $model = ConstituteOfIRB::class;
        $steps=[
            'student',
            'faculty',
            'hod',
            'adordc',
            'dordc'
        ];
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model,$steps);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'dra':
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'adordc':
                return $this->handleAdordcForm($user,$form_id,$model);
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
            case 'adordc':
                return $this->adordcSubmit($user, $request, $form_id);
            case 'dra':
                return $this->draSubmit($user, $request, $form_id);
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
        $form_id = $request->form_id;
        if($role->role != 'dra'){
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $request->validate([
            'form_ids' => 'required|array',
        ]);
        $request->validate([
            'form_ids.*' => 'integer|exists:constitute_of_irbs,id',
        ]);
        $request->merge(['approval' => true]);
        foreach ($request->form_ids as $formId) {
            $form = ConstituteOfIRB::find($formId);
            if (!$form) {
                return response()->json(['message' => 'Form not found'], 404);
            }
            $this->draSubmit($user, $request, $formId);
        }
        return response()->json(['message' => 'Forms submitted successfully'], 200);
    }

    private function studentSubmit($user, Request $request, $form_id)
    {
        $request->validate([
            'semester' => 'integer',
            'gender' => 'string|in:Male,Female',
            'cgpa' => 'numeric',
            'objectives' => 'required|array',
            'title' => 'required|string',
            'irb_pdf' => 'required|file|mimes:pdf|max:20480',
            'address' => 'required|string',
            'broad_area_of_research' => 'nullable|string',
            'subdomains' => 'nullable|array',
            'subdomains.*' => 'string',
        ]);
        return $this->submitForm($user,$request, $form_id, ConstituteOfIRB::class, 'student','student','faculty',  function ($formInstance) use ($request, $user) {
            if(!$formInstance->student->gender) {
                $request->validate([
                    'cgpa' => 'required|numeric',
                ]);
            }
            if(!$formInstance->student->cgpa) {
                $request->validate([
                    'gender' => 'required|string|in: Male,Female'
                ]);}
            $formInstance->update([
                'semester' => $request->semester,
            ]);
            $gender = $request->gender;
            $cgpa = $request->cgpa;
            if($gender){
                $formInstance->student->user->update([
                    'gender' => $gender,
                ]);
            }
            if($cgpa){
                $formInstance->student->update([
                    'cgpa' => $cgpa,
                ]);
            } 
            $request->validate([
                'address' => 'required|string',
            ]);
            
            //save objectives
            $objectives = $request->objectives;
            $formInstance->student->objectives()->where('type', 'draft')->delete();
            foreach ($objectives as $objective) {
               PHDObjective::create([
                    'student_id' => $formInstance->student->roll_no,
                    'objective' => $objective,
                    'type' => 'draft',
                ]);
            }
            //save pdf
            $link=$this->saveUploadedFile($request->file('irb_pdf'), 'irb_const', $user->student->roll_no);
           
            $formInstance->student->address = $request->address;
            
            // Save broad area of research (free text, or a legacy AreaOfSpecialization id)
            if ($request->has('broad_area_of_research') && $request->broad_area_of_research) {
                $formInstance->broad_area_of_research = $request->broad_area_of_research;
                // Only link the structured area FK when the value is a real, existing
                // area id — a numeric-looking free-text entry must not hit the FK.
                if (is_numeric($request->broad_area_of_research)
                    && \App\Models\AreaOfSpecialization::whereKey($request->broad_area_of_research)->exists()) {
                    $formInstance->student->area_of_specialization_id = $request->broad_area_of_research;
                }
            }

            // Save subdomain keywords (reusable per student). Only touch them when the
            // request actually carries the field, so a resubmit that omits it never
            // wipes the student's set. Normalise + de-dupe, drop blanks / too-short.
            if ($request->has('subdomains')) {
                $subdomains = collect($request->subdomains ?? [])
                    ->map(fn ($k) => trim(preg_replace('/\s+/', ' ', (string) $k)))
                    ->filter(fn ($k) => mb_strlen($k) >= 2)
                    ->unique()
                    ->values();
                $formInstance->student->subdomains()->delete();
                foreach ($subdomains as $keyword) {
                    \App\Models\StudentSubdomain::create([
                        'student_id' => $formInstance->student->roll_no,
                        'keyword' => $keyword,
                    ]);
                }
            }
            
            $formInstance->student->save();
            $formInstance->phd_title = $request->title;

            $formInstance->irb_pdf = $link;
            $formInstance->save();
            $formInstance->student->save();

            if($formInstance->supervisorApprovals())
            $formInstance->supervisorApprovals()->delete();

            //disable all previous approvals
            $supervisors = $formInstance->student->supervisors;
            foreach ($supervisors as $supervisor) {
                $formInstance->supervisorApprovals()->create([
                    'supervisor_id' => $supervisor->faculty_code,
                    'status' => 'awaited',
                ]);
            }

            $formInstance->student->user->save();
        });
    }

    private function supervisorSubmit($user, Request $request, $form_id)
    {
       
    
        return $this->submitForm($user,$request, $form_id, ConstituteOfIRB::class, 'faculty','student','hod', function ($formInstance) use ($request, $user) {
            // Check if nominee cognates are valid
            $request->validate([
                'nominee_cognates' => 'array|required',
                'nominee_cognates.*' => 'integer|required',
            ]);

            $nomineeCognates = $request->nominee_cognates;
            if (!$nomineeCognates) {
                throw new \Exception('Nominee cognates are required');
            }
            // Ensure there are exactly 3 nominee cognates
            if (count($nomineeCognates) != 3) {
                throw new \Exception('Exactly 3 nominee cognates are required');
            }
    
            // Check if all nominee cognates are different
            $uniqueNomineeCognates = array_unique($nomineeCognates);
            if (count($uniqueNomineeCognates) != 3) {
                throw new \Exception('Nominee cognates must be unique');
            }
    
            // Check if all nominee cognates are valid faculty
            foreach ($nomineeCognates as $nomineeCognate) {
                $faculty = Faculty::find($nomineeCognate);
                if (!$faculty) {
                    throw new \Exception('Invalid faculty code');
                }
                if($formInstance->student->checkSupervises($nomineeCognate)){
                    throw new \Exception('Supervisor can not be a nominee cognate');
                }
                // if($faculty->department_id != $formInstance->student->department_id){
                //     throw new \Exception('Nominee cognates must be from the same department');
                // }
            }
            $oldNomineeCognates=IrbNomineeCognate::where('irb_form_id',$formInstance->id)->get();
            if(count($oldNomineeCognates) != 0){
                foreach($oldNomineeCognates as $oldNomineeCognate){
                    $oldNomineeCognate->delete();
                }
                $formInstance->addHistoryEntry("Supervisor changed nominee cognates", $user->name());
            }
            
            foreach ($nomineeCognates as $nomineeCognate) {
                IrbNomineeCognate::create([
                    'irb_form_id' => $formInstance->id,
                    'nominee_id' => $nomineeCognate,
                    'supervisor_id' => $user->faculty->faculty_code,
                ]);
            }


            $faculty_code = $user->faculty->faculty_code;
            //mark supervisor approval
            if($request->approval){
            
                if($formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->first()->status=='approved'){
                    throw new \Exception('You have already approved the form, Can Only Submit once all the supervisors approve');
                }
    
                $formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->update([
                  'status' => 'approved',
                ]);
                
                $formInstance->addHistoryEntry("Supervisor Approved The Form", $user->name());
        
                $approvals=$formInstance->supervisorApprovals()->where('status','approved')->get();
               
                if($approvals->count()!=$formInstance->student->supervisors->count()){
                    throw new \Exception('Your Prefrences Saved, Form Will be submitted once all Supervisors approve',201);
                }
            }
            else{
                $formInstance->supervisorApprovals()->where('supervisor_id', $faculty_code)->update([
                  'status' => 'rejected',
                ]);
            }

          
        });
    }
    
    private function hodSubmit($user, Request $request, $form_id)
    {
        
        return $this->submitForm(
            $user, 
            $request, 
            $form_id, 
            ConstituteOfIRB::class, 
            'hod', 
            'faculty', 
            'adordc', 
            function ($formInstance, $user) use ($request) {
                $request->validate([
                    'chairman_experts' => 'array|required',
                    'chairman_experts.*' => 'integer|required',
                    'outside_experts' => 'array|required',
                    'outside_experts.*' => 'integer|required',
                  ]);

                if(!$request->chairman_experts){
                    throw new \Exception('Chairman Experts are Required');
                }
                // Handling cognate experts
                $oldChairmanExperts=IrbExpertChairman::where('irb_form_id',$formInstance->id)->get();
                if(count($oldChairmanExperts) != 0){
                    foreach($oldChairmanExperts as $oldChairmanExpert){
                        $oldChairmanExpert->delete();
                    }
                    $formInstance->addHistoryEntry("HOD changed cognate experts", $user->name());
                }
                foreach ($request->chairman_experts as $chairmanExpert) {
                    $faculty = Faculty::where('faculty_code', $chairmanExpert)->first();
                    if ($faculty) {
                        if($formInstance->student->checkSupervises($faculty->faculty_code)){
                            throw new \Exception('Supervisor can not be a cognate expert');
                        }
                        if($formInstance->student->department_id != $faculty->department_id){
                            throw new \Exception('Cognate experts must be from the same department');
                        }
                        IrbExpertChairman::create([
                            'irb_form_id' => $formInstance->id,
                            'expert_id' => $chairmanExpert,
                        ]);
                    }
                    else{
                        throw new \Exception('Invalid faculty code');
                    }
                }
                $formInstance->addHistoryEntry("HOD added cognate experts", $user->name());
                $uniqueOutsideExperts = array_unique($request->outside_experts);
                if (count($uniqueOutsideExperts) != 3) {
                    throw new \Exception('Outside experts must be unique and exactly 3');
                }
    
                $oldOutsideExperts=IrbOutsideExpert::where('irb_form_id',$formInstance->id)->get();
                if(count($oldOutsideExperts) != 0){
                    foreach($oldOutsideExperts as $oldOutsideExpert){
                        $oldOutsideExpert->delete();
                    }
                    $formInstance->addHistoryEntry("Supervisor changed outside experts", $user->name());
                }
    
                foreach ($request->outside_experts as $outsideExpert) {
                    $expert=OutsideExpert::find($outsideExpert);
                    if(!$expert){
                        throw new \Exception('Invalid outside expert');
                    }
                    IrbOutsideExpert::create([
                        'irb_form_id' => $formInstance->id,
                        'expert_id' => $outsideExpert,
                        'hod_id' => $user->id,
                    ]);
                } 
            }
        );
    }
    
    
    private function draSubmit($user, Request $request, $form_id){
        return $this->submitForm(
            $user, 
            $request, 
            $form_id, 
            ConstituteOfIRB::class, 
            'dra', 
            'hod', 
            'adordc',   function ($formInstance, $user) use ($request) {}
        );
    }

    private function adordcSubmit($user, Request $request, $form_id){
        return $this->submitForm(
            $user, 
            $request, 
            $form_id, 
            ConstituteOfIRB::class, 
            'adordc', 
            'dra', 
            'dordc',   function ($formInstance, $user) use ($request) {}
        );
    }
    
    private function dordcSubmit($user, Request $request, $form_id)
    {
        return $this->submitForm(
            $user, 
            $request, 
            $form_id, 
            ConstituteOfIRB::class, 
            'dordc', 
            'hod', 
            'complete',
            function ($formInstance, $user) use ($request) {
                    $request->validate([
                        'outside_expert' =>"integer|required",
                        'cognate_expert' => 'integer|required',
                    ]);
            
                    $outsideExpertId = $request->outside_expert;
                    $cognateExpertId = $request->cognate_expert;

                    $outsideExpert = IrbOutsideExpert::where('irb_form_id', $formInstance->id)->where('expert_id', $outsideExpertId)->first();
                    $cognateExpert = IrbNomineeCognate::where('irb_form_id', $formInstance->id)->where('nominee_id', $cognateExpertId)->first();

                    if(!$outsideExpert || !$cognateExpert) {
                        throw new \Exception('Invalid expert selection');
                    }
                    $outsideExpert=OutsideExpert::find($outsideExpertId);
                     
                        IRBCommittee::create([
                            'student_id'  => $formInstance->student->roll_no,
                            'type'        => 'outside',
                            'member_type' => OutsideExpert::class,
                            'member_id'   => $outsideExpert->id,
                        ]);
                        // No login account is created for the outside expert — the external
                        // review happens via a secure email link (see IrbSubForm::
                        // sendExternalReviewRequest / ExternalReviewController), attributed
                        // to the OutsideExpert record, so no portal user is needed.

                    DoctoralCommittee::create([
                        'student_id' => $formInstance->student->roll_no,
                        'faculty_id' => $cognateExpertId,
                        'type' => 'internal',
                    ]);

                    
                    IRBCommittee::create([
                        'student_id'  => $formInstance->student->roll_no,
                        'type'        => 'inside',
                        'member_type' => Faculty::class,
                        'member_id'   => $cognateExpertId,
                    ]);
                    
                    $irbExperts=IrbExpertChairman::where('irb_form_id',$formInstance->id)->get();
                    foreach($irbExperts as $irbExpert){
                        DoctoralCommittee::create([
                            'student_id' => $formInstance->student->roll_no,
                            'faculty_id' => $irbExpert->expert_id,
                            'type' => 'internal',
                        ]);
                        IRBCommittee::create([
                            'student_id'  => $formInstance->student->roll_no,
                            'type'        => 'inside',
                            'member_type' => Faculty::class,
                            'member_id'   => $irbExpert->expert_id,
                        ]);
                    }
                    $area=$formInstance->student->areaOfSpecialization;
                    $expert=$area->getExpertFaculty();
                    DoctoralCommittee::create([
                        'student_id' => $formInstance->student->roll_no,
                        'faculty_id' => $expert->faculty_code,
                        'type' => 'external',
                    ]);
                    $formInstance->update([
                        'outside_expert' => $outsideExpertId,
                        'cognate_expert' => $cognateExpertId,
                        'completion'=>'complete',
                    ]);
                    $student=$formInstance->student;
                    $student->phd_title= $formInstance->phd_title;
                    $student->save();
                    $formInstance->save();

                    $forms = [
                        [
                            'form_type' => 'irb-submission',
                            'form_name' => 'Revised IRB',
                            'max_count' => 1,
                            'stage' => 'student',
                        ],
                        [
                            'form_type' => 'irb-extension',
                            'form_name' => 'IRB Extension',
                            'max_count' => 10,
                            'stage' => 'student',
                        ],
                    ];
                    $student = $formInstance->student;
                    foreach ($forms as $form) {
                        $existingForm = Forms::where('student_id', $student->roll_no)
                            ->where('form_type', $form['form_type'])
                            ->first();

                        if (!$existingForm) {
                            $formData = (new \App\Http\Controllers\AdminFormController())->getFormCreationData(
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

}
