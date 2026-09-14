<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\ThesisSubmission;

class ThesisSubmissionController extends Controller
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
         return $this->listFormsStudent($user, ThesisSubmission::class, $student_id);
       return $this->listForms($user, ThesisSubmission::class,$request,null,false,[
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
                // The form records its own synopsis date, which the scholar's record
                // often lacks. Carbon::parse(null) is today, so it is not used.
                return $form->date_of_synopsis ?: $form->student->date_of_synopsis?->format('Y-m-d');
        
            },
        ],
        'titles' => [ "Name", "Roll No","Date of Synopsis","Supervisors"],
    ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps=['student','faculty','phd_coordinator','hod','dra','dordc','complete'];
        if($role->role != 'student'){
            return $this->refuse();
        }
        $data=[
            'roll_no'=>$user->student->roll_no,
            'steps'=>$steps,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(ThesisSubmission::class, $data);
    }

    
    public function loadForm(Request $request, $form_id=null)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        $model = ThesisSubmission::class;
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            // Reads the form, answers nothing. Not a step in the chain.
            case 'adordc':
                return $this->handleAdordcForm($user,$form_id,$model);
            case 'dra':
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
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
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'dra':
                return $this->draSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'phd_coordinator':
                return $this->coordinatorSubmit($user, $request, $form_id);
            default:
                return $this->refuse();
        }
    }
    public function linkPublication(Request $request, $form_id)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        try{
        $user = Auth::user();
        $role = $user->current_role;
        if($role->role!='student'){
            return $this->refuse();
        }
        $formInstance=ThesisSubmission::find($form_id);
        // A scholar links and unlinks on their own form only.
        if (!$formInstance || $formInstance->student_id != $user->student?->roll_no) {
            return $this->refuse();
        }
        if(count($this->selectedIds($request, 'publications')) != 0){
            foreach ($this->selectedIds($request, 'publications') as $publication) {
                $publication = Publication::find($publication);
                if (!$publication) {
                    throw new \Exception("Invalid publication selected");
                }
                if($publication->student_id != $user->student->roll_no){
                    throw new \Exception("Invalid publication selected");
                }
                $existingPublication = Publication::where('title', $publication->title)
                ->where('form_id', $formInstance->id)
                ->where('publication_type',$publication->publication_type)
                ->where('form_type','thesis')
                ->first();
            if ($existingPublication) {
                throw new \Exception("Publication with the same title already linked to this form");
            }
                $newPublication = $publication->replicate();
                $newPublication->form_id = $formInstance->id;
                $newPublication->form_type = 'thesis';
                
                $newPublication->save();
      
               
            }
        }
        if(count($this->selectedIds($request, 'patents')) != 0){
            foreach ($this->selectedIds($request, 'patents') as $patent) {
                $patent = Patent::find($patent);
                if (!$patent) {
                    throw new \Exception("Invalid patent selected");
                }
                if($patent->student_id != $user->student->roll_no){
                    throw new \Exception("Invalid patent selected");
                }
                $existingPatent = Patent::where('title', $patent->title)
                ->where('form_id', $formInstance->id)
                ->where('form_type','thesis')
                ->first();
            if ($existingPatent) {
                throw new \Exception("Patent with the same title  already linked to this form");
            }
                $newPatent = $patent->replicate();
                $newPatent->form_id = $formInstance->id;
                $newPatent->form_type = 'thesis';
                $newPatent->save();

            }
        }
        return response()->json(['message' => 'Publications linked to Presentation'], 200);
    }
    catch (\Exception $e) {
        return response()->json(['message' => $e->getMessage()], 400);
    }
    }

    public function unlinkPublication(Request $request, $form_id)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        if($role->role!='student'){
            return $this->refuse();
        }
        $formInstance=ThesisSubmission::find($form_id);
        // A scholar links and unlinks on their own form only.
        if (!$formInstance || $formInstance->student_id != $user->student?->roll_no) {
            return $this->refuse();
        }
        if(count($this->selectedIds($request, 'publications')) != 0){
            foreach ($this->selectedIds($request, 'publications') as $publication) {
                $publication = Publication::where('id',$publication)->where('form_id',$formInstance->id)->where('form_type','thesis');
                $publication->delete();
            }
        }
        if(count($this->selectedIds($request, 'patents')) != 0){
            foreach ($this->selectedIds($request, 'patents') as $patent) {
                $patent = Patent::where('id',$patent)->where('form_id',$formInstance->id)->where('form_type','thesis');
                $patent->delete();
            }
        }
        return response()->json(['message' => 'Publications unlinked from Presentation'], 200);
    }

    /**
     * The Institute's submission window, checked at the one point a thesis
     * actually leaves the student. Too early is a flat no; too late is a no
     * with the extension route named, since that is the only way back in.
     */
    private function windowRefusal($student)
    {
        $window = $student?->thesisWindow();
        if (!$window) {
            return null;
        }

        $today = now()->toDateString();

        if ($today < $window['earliest']) {
            return response()->json([
                'message' => 'A thesis cannot be submitted before ' . $window['earliest']
                    . ', the minimum period from your date of admission.',
            ], 403);
        }

        if ($today > $window['latest']) {
            return response()->json([
                'message' => 'Your submission period ended on ' . $window['latest']
                    . '. Apply for a thesis extension before submitting.',
            ], 403);
        }

        return null;
    }

    private function studentSubmit($user, $request, $form_id)
    {
        $model = ThesisSubmission::class;

        $refusal = $this->windowRefusal($user->student);
        if ($refusal) {
            return $refusal;
        }

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'student',
            'student',
            'faculty',
            function ($formInstance) use ($request, $user) {
                // A resubmission after a send-back keeps the stored files unless new ones come.
                $request->validate([
                    'date_of_synopsis' => 'required|date',
                    'reciept_no' => 'required|string',
                    'date_of_fee_submission' => 'required|date',
                    'thesis_pdf' => ($formInstance->thesis_pdf ? 'nullable' : 'required').'|file|mimes:pdf|max:20480',
                    'fee_receipt' => ($formInstance->fee_receipt ? 'nullable' : 'required').'|file|mimes:pdf,jpg,jpeg,png|max:20480',
                ]);
                $formInstance->date_of_synopsis = $request->date_of_synopsis;
                if ($formInstance->student->date_of_synopsis == null) {
                    $formInstance->student->date_of_synopsis = $request->date_of_synopsis;
                    $formInstance->student->save();
                }
                $formInstance->reciept_no = $request->reciept_no;
                $formInstance->date_of_fee_submission = $request->date_of_fee_submission;
                if ($request->hasFile('thesis_pdf')) {
                    $formInstance->thesis_pdf = $this->replaceUploadedFile($formInstance->thesis_pdf, $request->file('thesis_pdf'), 'thesis', $user->student->roll_no);
                }
                if ($request->hasFile('fee_receipt')) {
                    $formInstance->fee_receipt = $this->replaceUploadedFile($formInstance->fee_receipt, $request->file('fee_receipt'), 'fee_receipt', $user->student->roll_no);
                }
               
        }
        );
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
       
        $allowedRoles = ['hod', 'phd_coordinator', 'dra', 'dordc', 'director'];
        if (!in_array($role->role, $allowedRoles)) {
            return $this->refuse();
        }
        $request->validate([
            'form_ids' => 'required|array',
            'approval' => 'required|boolean',
        ]);
        $request->merge(['approval' => true]);
        $results = [];
        $hasFailure = false;
        foreach ($request->form_ids as $form_id) {
            $response = $this->submit($request, $form_id);
            $results[] = ['form_id' => $form_id] + $response->getData(true);
            if ($response->getStatusCode() >= 400) {
                $hasFailure = true;
            }
        }
        return response()->json([
            'message' => $hasFailure ? 'Some forms could not be submitted' : 'Forms submitted successfully',
            'results' => $results,
        ], $hasFailure ? 422 : 200);
    }
    private function supervisorSubmit($user, $request, $form_id)
    {
        $model = ThesisSubmission::class;
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
        $model = ThesisSubmission::class;
      
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
        $model = ThesisSubmission::class;
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
        $model = ThesisSubmission::class;
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
        $model = ThesisSubmission::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'dordc',
            'dra',
            'complete',
            function ($formInstance) use ($request, $user) {
                if ($request->approval) {
                    $formInstance->completion='complete';
                    $formInstance->status = 'approved';
                    if ($formInstance->student->date_of_thesis == null) {
                        $formInstance->student->date_of_thesis = now()->toDateString();
                        $formInstance->student->save();
                    }
                    $formInstance->addHistoryEntry("Thesis approved by DORDC", $user->name());
                }
            }
        );
    }
}
