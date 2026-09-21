<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use Illuminate\Http\Request;

use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Patent;
use App\Models\Publication;
use App\Models\SynopsisObjectives;
use App\Models\SynopsisChecklistOption;
use App\Models\SynopsisSubmission;

class SynopsisSubmissionController extends Controller
{
    
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use SaveFile;
    use GeneralFormCreate;
    use FilterLogicTrait;
    /**
     * The synopsis is approved twice.
     *
     * Round one is the written submission. The viva then happens offline, on the
     * department's own arrangements; round two is the confirmation of it, and it
     * cannot start until the coordinator has uploaded the minutes, which is why
     * the coordinator holds the first step of it rather than the supervisor.
     *
     * `steps` on the row stays the round-one list. That array decides who may
     * read the form and what the ladder draws, and `current_step` and
     * `maximum_step` are indices into it, so a role appearing in it twice would
     * give array_search the wrong answer in every place that reads it. The round
     * decides where an approval goes next, and nothing else.
     */
    private const ROUND_ONE = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc'];
    private const ROUND_TWO = ['phd_coordinator', 'faculty', 'doctoral', 'hod', 'dordc'];
    private const STEPS = ['student', 'faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc', 'complete'];

    /** The roles that answer again after the viva, and so have to be reopened. */
    private const CONFIRM_AFTER_VIVA = ['supervisor', 'doctoral', 'hod'];

    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }
    public function listForm(Request $request, $student_id=null)
    {
       $user = Auth::user();
       if($student_id)
         return $this->listFormsStudent($user, SynopsisSubmission::class, $student_id);
       return $this->listForms($user, SynopsisSubmission::class,$request,null,false,[
        'fields' => [
            "name","roll_no","revised_title","synopsis_pdf"
        ],
        'extra_fields' => [
            "synopsis_pdf" => function ($form) {
                return $form->synopsis_pdf;
            },
        ],
        'titles' => [ "Name", "Roll No","Revised Title","Synopsis PDF"],
    ]);
    }

    /**
     * Raise the synopsis.
     *
     * Only once the coursework is done. The credits required are per status and
     * admin-editable (AppSetting group 'coursework'); what the scholar has is
     * the sum of the courses marked complete on their profile.
     */
    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        if($role->role != 'student'){
            return $this->refuse();
        }

        $student = $user->student;

        // The coursework gate is off until the course types are settled. UGC
        // mandatory courses are to be counted separately from the rest, which
        // means `courses` grows a type and completedCredits() splits into two
        // totals, so the single figure this compared against is about to stop
        // being the rule. Turn it back on once that lands, together with the
        // skipped tests in SynopsisVivaRoundTest.
        //
        // if (!$student->hasFinishedCoursework()) {
        //     return response()->json([
        //         'message' => 'The synopsis opens once your coursework is complete. You have '
        //             . $this->credits($student->completedCredits()) . ' of the '
        //             . $student->requiredCredits() . ' credits required. Your courses are listed on your profile.',
        //     ], 400);
        // }

        $data=[
            'roll_no'=>$student->roll_no,
            'steps'=>self::STEPS,
            'role'=>$role->role,
            'name'=>$user->first_name.' '.$user->last_name
        ];
        return $this->createForms(SynopsisSubmission::class, $data);
    }

    /** 14.0 reads as 14, 13.5 stays 13.5. */
    private function credits(float $credits): string
    {
        return rtrim(rtrim(number_format($credits, 1, '.', ''), '0'), '.');
    }

    /**
     * The step this user is acting as.
     *
     * A committee member signs in holding 'faculty'. Only that role is mapped:
     * a HOD or a coordinator who also sits on the committee holds their own step
     * on this form, and round two puts the coordinator and the supervisor in
     * different places, so mapping either of them to 'doctoral' would send the
     * form to the wrong person.
     */
    private function actingStep($user, $form_id): string
    {
        $role = $user->current_role->role;
        if ($role !== 'faculty') {
            return $role;
        }

        $form = SynopsisSubmission::find($form_id);
        return $form && $form->student->checkDoctoralCommittee($user->faculty?->faculty_code) ? 'doctoral' : $role;
    }

    /**
     * Where an approval by $role goes next, and where a rejection sends it back.
     *
     * Read from the round rather than hardcoded per method, because the two
     * rounds put the same people in a different order.
     */
    private function neighbours($formInstance, string $role): array
    {
        $round = (int) ($formInstance->round ?: 1);
        $order = $round >= 2 ? self::ROUND_TWO : self::ROUND_ONE;
        $at = array_search($role, $order, true);
        if ($at === false) {
            // This role holds no step in this round: the scholar, in round two.
            // submitForm's stage check refuses them before either of these is
            // read, but array_search answering false would index as 0 and hand
            // the form to somebody else's step, which is worse than a refusal.
            return [$role, $role];
        }

        // The first step of a round falls back to itself: there is nothing
        // behind it to reject to.
        $previous = $at > 0 ? $order[$at - 1] : $order[0];

        if ($at < count($order) - 1) {
            return [$previous, $order[$at + 1]];
        }

        // The end of a round. Round one hands over to the viva, which means back
        // to the coordinator, who holds the form until the minutes exist.
        return [$previous, $round >= 2 ? 'complete' : self::ROUND_TWO[0]];
    }

    /** submitForm with this form's neighbours worked out from the round. */
    private function submitAs($user, $request, $form_id, string $role, ?callable $extraSteps = null)
    {
        $formInstance = SynopsisSubmission::find($form_id);
        if (!$formInstance) {
            return response()->json(['message' => 'No form found'], 404);
        }

        [$previous, $next] = $this->neighbours($formInstance, $role);

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            SynopsisSubmission::class,
            $role,
            $previous,
            $next,
            $extraSteps
        );
    }

    
    public function loadForm(Request $request, $form_id=null)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        $model = SynopsisSubmission::class;
       switch ($this->actingStep($user, $form_id)) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            
            case 'doctoral':
                return $this->handleDoctoralForm($user,  $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            // Reads the form, answers nothing. Not a step in the chain.
            case 'adordc':
                return $this->handleAdordcForm($user,$form_id,$model);
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'faculty':
                return $this->handleFacultyForm($user, $form_id, $model);
            // Neither holds a step in this chain, so there is no index to check
            // and the read is unconditional. GeneralFormList lists the director
            // every form whose chain does not name them, and refusing to open
            // what it listed is a dead end rather than a boundary.
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
        switch ($this->actingStep($user, $form_id)) {
            case 'student':
                return $this->studentSubmit($user, $request, $form_id);
            case 'faculty':
                return $this->supervisorSubmit($user, $request, $form_id);
            case 'doctoral':
                return $this->doctoralFormSubmit($user, $request, $form_id);
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'phd_coordinator':
                return $this->coordinatorSubmit($user, $request, $form_id);
            default:
                return $this->refuse();
        }
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
       
        $allowedRoles = ['hod', 'phd_coordinator', 'dordc'];
        if (!in_array($role->role, $allowedRoles)) {
            return $this->refuse();
        }
        $request->validate([
            'form_ids' => 'required|array',
            'approval' => 'required|boolean',
        ]);
        $request->merge(['approval' => true]);
        foreach ($request->form_ids as $form_id) {
            $this->submit($request, $form_id);
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
        $formInstance=SynopsisSubmission::find($form_id);
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
                ->where('form_type','synopsis')
                ->first();
            if ($existingPublication) {
                throw new \Exception("Publication with the same title already linked to this form");
            }
                $newPublication = $publication->replicate();
                $newPublication->form_id = $formInstance->id;
                $newPublication->form_type = 'synopsis';
                
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
                ->where('form_type','synopsis')
                ->first();
            if ($existingPatent) {
                throw new \Exception("Patent with the same title  already linked to this form");
            }
                $newPatent = $patent->replicate();
                $newPatent->form_id = $formInstance->id;
                $newPatent->form_type = 'synopsis';
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
        $formInstance=SynopsisSubmission::find($form_id);
        // A scholar links and unlinks on their own form only.
        if (!$formInstance || $formInstance->student_id != $user->student?->roll_no) {
            return $this->refuse();
        }
        if(count($this->selectedIds($request, 'publications')) != 0){
            foreach ($this->selectedIds($request, 'publications') as $publication) {
                $publication = Publication::where('id',$publication)->where('form_id',$formInstance->id)->where('form_type','synopsis');
                $publication->delete();
            }
        }
        if(count($this->selectedIds($request, 'patents')) != 0){
            foreach ($this->selectedIds($request, 'patents') as $patent) {
                $patent = Patent::where('id',$patent)->where('form_id',$formInstance->id)->where('form_type','synopsis');
                $patent->delete();
            }
        }
        return response()->json(['message' => 'Publications unlinked from Presentation'], 200);
    }

    private function studentSubmit($user, $request, $form_id)
    {
        return $this->submitAs(
            $user,
            $request,
            $form_id,
            'student',
            function ($formInstance) use ($request, $user) {
                $request->validate([
                   'revised_title' => 'string',
                   'synopsis_pdf' => 'required|file|mimes:pdf|max:20480',
                ]);
                $formInstance->revised_title = $request->revised_title;
                $link=$this->replaceUploadedFile($formInstance->synopsis_pdf, $request->file('synopsis_pdf'), 'synopsis', $user->student->roll_no);
                $formInstance->synopsis_pdf = $link;
            }
        );
    }

    /**
     * The category the supervisor declares the scholar has met, chosen from the
     * options their department and admission date qualify them for.
     *
     * A scholar no rule covers is asked for nothing. That is deliberate: the
     * alternative is a synopsis that cannot be filed at all because an admin has
     * not written the condition for that department or those years yet.
     */
    private function recordChecklistChoice($formInstance, $request): void
    {
        // Sending the form back is not a declaration: the supervisor is asking
        // for a correction, not certifying a category, and the callback runs
        // either way.
        if (!$request->boolean('approval')) {
            return;
        }

        $options = SynopsisChecklistOption::forStudent($formInstance->student);
        if ($options->isEmpty()) {
            return;
        }

        $request->validate(['checklist_option_id' => 'required|integer']);

        if (!$options->contains('id', (int) $request->checklist_option_id)) {
            throw new \Exception('Choose one of the categories listed for this scholar.');
        }

        $formInstance->checklist_option_id = (int) $request->checklist_option_id;
    }

    private function supervisorSubmit($user, $request, $form_id)
    {
        return $this->submitAs(
            $user,
            $request,
            $form_id,
            'faculty',
            function ($formInstance) use ($request, $user) {
                // Progress is the written submission's measure, taken once. The
                // supervisor confirming after the viva is confirming the viva,
                // not re-scoring the work.
                if ((int) $formInstance->round >= 2) {
                    return;
                }

                $request->validate([
                   'current_progress' => 'integer',
                ]);
                $formInstance->current_progress = $request->current_progress;
                $oldProgress=$formInstance->student->overall_progress;
                $formInstance->total_progress = $oldProgress + $request->current_progress;
                $this->recordChecklistChoice($formInstance, $request);
            }
        );
    }

    private function doctoralFormSubmit($user, $request, $form_id)
    {
        return $this->submitAs($user, $request, $form_id, 'doctoral');
    }

    private function coordinatorSubmit($user, $request, $form_id)
    {
        return $this->submitAs(
            $user,
            $request,
            $form_id,
            'phd_coordinator',
            function ($formInstance) use ($request, $user) {
                if ((int) $formInstance->round < 2) {
                    return;
                }

                // The viva is held offline and on the department's own
                // arrangements, so the minutes are the only record in the portal
                // that it happened. Round two does not move without them.
                //
                // Required until they exist, optional afterwards: a form sent
                // back to the coordinator already has its minutes, and asking
                // for the same file again to answer a comment is busywork.
                $request->validate([
                    'viva_minutes_pdf' => ($formInstance->viva_minutes_pdf ? 'nullable' : 'required')
                        . '|file|mimes:pdf|max:20480',
                ]);

                if ($request->hasFile('viva_minutes_pdf')) {
                    $formInstance->viva_minutes_pdf = $this->replaceUploadedFile(
                        $formInstance->viva_minutes_pdf,
                        $request->file('viva_minutes_pdf'),
                        'synopsis_viva_minutes',
                        $formInstance->student_id
                    );
                }
            }
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        return $this->submitAs($user, $request, $form_id, 'hod');
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        return $this->submitAs(
            $user,
            $request,
            $form_id,
            'dordc',
            function ($formInstance, $user) {
                // Only reached on an approval: submitForm returns a rejection to
                // the previous step before it runs any extra steps.
                if ((int) $formInstance->round < 2) {
                    $this->openVivaRound($formInstance, $user);
                    return;
                }

                $this->completeSynopsis($formInstance, $user);
            }
        );
    }

    /**
     * End of the written round. The form goes back to the coordinator and waits
     * for the viva minutes.
     *
     * Everyone who confirms afterwards has to answer again, so their columns are
     * cleared. What they said the first time is in the history, which is the
     * record; the columns hold the current round. The coordinator's own lock is
     * cleared by the move to their step, and the DORDC's by the move back to
     * theirs at the end of round two.
     */
    private function openVivaRound($formInstance, $user): void
    {
        $formInstance->round = 2;

        foreach (self::CONFIRM_AFTER_VIVA as $role) {
            $formInstance->{$role . '_lock'} = false;
            $formInstance->{$role . '_approval'} = false;
            $formInstance->{$role . '_comments'} = null;
        }

        $formInstance->addHistoryEntry(
            'Written synopsis approved. Awaiting the viva and its minutes from the PhD Coordinator.',
            $user->name()
        );
    }

    private function completeSynopsis($formInstance, $user): void
    {
        $formInstance->completion = 'complete';
        $formInstance->status = 'approved';

        $student = $formInstance->student;
        $student->phd_title = $formInstance->revised_title;
        $student->overall_progress = $formInstance->total_progress;
        $student->save();

        $formInstance->addHistoryEntry('Synopsis approved by DORDC after the viva', $user->name());
    }
}
