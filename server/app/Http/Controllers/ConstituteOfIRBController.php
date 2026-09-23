<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Models\ConstituteOfIRB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\IrbExpertChairman;
use App\Models\IrbNomineeCognate;
use App\Models\IrbOutsideExpert;
use App\Models\OutsideExpert;
use App\Support\FormLadder;
use App\Support\ScholarCommittee;
use App\Models\Role;
use App\Models\User;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Department;
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
            "name","roll_no", "email","supervisors","broad_area_of_research"
        ],
        'extra_fields' => [
            "email" => function ($form) {
            return $form->student->user->email;
            },
            "supervisors" => function ($form) {
            return $form->student->supervisors->map(function ($supervisor) {
                return $supervisor->user->name();
            })->join(', ');
            },
            'broad_area_of_research' => function ($form) {
                return $form->student->broadAreaLabel();
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
            'phd_coordinator',
            'hod',
            'dra',
            'dordc',
            'complete'
        ];
        if($role->role != 'student'){
            return $this->refuse();
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
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        $model = ConstituteOfIRB::class;
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            case 'dra':
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            // Reads the form, answers nothing. Not a step in the chain.
            case 'adordc':
                return $this->handleAdordcForm($user,$form_id,$model);
            case 'faculty':
                return $this->handleFacultyForm($user, $form_id, $model);
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
            default:
                return $this->refuse();
        }
    }

    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $form_id = $request->form_id;
        if($role->role != 'dra'){
            return $this->refuse();
        }
        $request->validate([
            'form_ids' => 'required|array',
        ]);
        $request->validate([
            'form_ids.*' => 'integer|exists:constitute_of_irb,id',
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
            'gender' => 'nullable|string|in:Male,Female',
            'cgpa' => 'nullable|numeric',
            'objectives' => 'required|array',
            'title' => 'required|string',
            'irb_pdf' => 'nullable|file|mimes:pdf|max:20480',
            'address' => 'required|string',
            'broad_area_of_research' => 'nullable|string|max:255',
            'subdomains' => 'nullable|array',
            'subdomains.*' => 'string',
        ]);
        return $this->submitForm($user,$request, $form_id, ConstituteOfIRB::class, 'student','student','faculty',  function ($formInstance) use ($request, $user) {
            // Each is asked for only when the profile lacks it. Gender lives on
            // the user, not the student.
            if(!$formInstance->student->cgpa) {
                $request->validate([
                    'cgpa' => 'required|numeric',
                ]);
            }
            if(!$formInstance->student->user?->gender) {
                $request->validate([
                    'gender' => 'required|string|in:Male,Female'
                ]);}
            // A resubmission after a send-back keeps the stored PDF unless a new one comes.
            if(!$formInstance->irb_pdf) {
                $request->validate([
                    'irb_pdf' => 'required|file|mimes:pdf|max:20480',
                ]);
            }
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
            $link = $request->hasFile('irb_pdf')
                ? $this->replaceUploadedFile($formInstance->irb_pdf, $request->file('irb_pdf'), 'irb_const', $user->student->roll_no)
                : $formInstance->irb_pdf;
           
            $formInstance->student->address = $request->address;
            
            // The scholar's settled research area, in their own words. The
            // department's curated areas are offered as suggestions, but this
            // is a description of the research and not a choice from a policy,
            // so anything is accepted. It lives on the scholar rather than on
            // this form, which used to hold a second copy of it.
            if ($request->filled('broad_area_of_research')) {
                $formInstance->student->broad_area = trim(preg_replace('/\s+/', ' ', $request->broad_area_of_research));
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
       
    
        return $this->submitForm($user,$request, $form_id, ConstituteOfIRB::class, 'faculty','student','phd_coordinator', function ($formInstance) use ($request, $user) {
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
                    throw new \Exception('A supervisor cannot be the nominee cognate expert.');
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
                    throw new \Exception('Your preferences are saved. The form moves on once every supervisor has approved.',201);
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
            'phd_coordinator', 
            'dra', 
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
                            throw new \Exception('A supervisor cannot be a cognate expert.');
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
    
    
    private function coordinatorSubmit($user, Request $request, $form_id){
        return $this->submitForm(
            $user, 
            $request, 
            $form_id, 
            ConstituteOfIRB::class, 
            'phd_coordinator', 
            'faculty', 
            'hod'
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
            'dordc'
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
            'dra', 
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
                    // The committee is the chosen cognate plus the cognate
                    // experts the HOD proposed. Written through ScholarCommittee so
                    // this and the students import cannot disagree about which
                    // tables a committee lives in.
                    $members = IrbExpertChairman::where('irb_form_id', $formInstance->id)
                        ->pluck('expert_id')
                        ->push($cognateExpertId)
                        ->all();

                    ScholarCommittee::constituted(
                        $formInstance->student,
                        $members,
                        OutsideExpert::find($outsideExpertId)
                    );

                    $formInstance->update([
                        'outside_expert' => $outsideExpertId,
                        'cognate_expert' => $cognateExpertId,
                        'completion'=>'complete',
                        // Student::irbCompleted() asks whether this form was
                        // approved, and nothing here ever said so: the status
                        // writes above are on supervisorApprovals, a different
                        // table. So a scholar whose IRB was constituted in the
                        // portal still counted as pre-IRB, their title read as
                        // tentative, and the supervisor change form refused to
                        // open. Every other form marks itself approved when its
                        // last step does; this one did not.
                        'status' => 'approved',
                    ]);
                    $student = $formInstance->student;
                    $student->phd_title = $formInstance->phd_title;
                    $student->save();
                    $formInstance->save();

                    FormLadder::open($student, 'irb-constitution');
            });
    }

}
