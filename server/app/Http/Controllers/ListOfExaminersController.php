<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Models\Examiner;
use App\Models\ExaminersRecommendation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Faculty;
use App\Models\Forms;
use App\Models\ListOfExaminersForm;
use App\Models\Role;
use App\Models\User;
use App\Support\ExaminerOverlap;

//TODO: add outside expert not in the system


class ListOfExaminersController extends Controller
{
    /** Examiners a supervisor must propose, and DoRDC must approve, per list. */
    private const REQUIRED_PER_LIST = 4;

    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use GeneralFormCreate;
    use FilterLogicTrait;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("forms"));
    }
    public function listForm(Request $request, $student_id = null)
    {
        $user = Auth::user();
        if ($student_id)
            return $this->listFormsStudent($user, ListOfExaminersForm::class, $student_id);
        return $this->listForms($user, ListOfExaminersForm::class,$request,null,false,[
            'fields' => [
                "name","roll_no","supervisors"
            ],
            'extra_fields' => [
                "supervisors" => function ($form) {
                return $form->student->supervisors->map(function ($supervisor) {
                    return $supervisor->user->name();
                })->join(', ');
                },
            ],
            'titles' => [ "Name", "Roll No","Supervisors"],
        ]);
    }

    public function createForm(Request $request)
    {
        $request->validate([
            'roll_no' => 'integer|required',
        ]);

        $user = Auth::user();
        $role = $user->current_role;
        $steps = [
            'faculty',
            'hod',
            'dordc',
            'director',
            'complete'
        ];
        if ($role->role != 'faculty') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $data = [
            'roll_no' => $request->roll_no,
            'steps' => $steps,
            'role' => 'supervisor',
            'supervisor_lock'=>0,
            'name' => $user->first_name . ' ' . $user->last_name
        ];
        return $this->createForms(ListOfExaminersForm::class, $data,null,true);
    }
    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
       
        $allowedRoles = ['director'];
        if (!in_array($role->role, $allowedRoles)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
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
    public function loadForm(Request $request, $form_id = null)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $model = ListOfExaminersForm::class;
        $steps = [
            'faculty',
            'hod',
            'dordc',
            'director',
        ];
        switch ($role->role) {
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
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

    /**
     * Withdraw a proposed examiner.
     *
     * Only while the form is still with the supervisor, and only for a
     * proposal nobody has ruled on yet: once DoRDC has approved or rejected
     * someone, that decision is part of the record and removing the row would
     * erase it. The person stays in the directory either way; what goes is the
     * claim that they were proposed for this student.
     */
    public function destroyExaminer(Request $request, $form_id, $recommendation_id)
    {
        $user = Auth::user();
        if ($user->current_role->role !== 'faculty') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        $form = ListOfExaminersForm::find($form_id);
        if (!$form) {
            return response()->json(['message' => 'No form found'], 404);
        }

        if (!$form->student->checkSupervises($user->faculty->faculty_code)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        if ($form->supervisor_lock || $form->stage !== 'supervisor') {
            return response()->json(['message' => 'This form is no longer with you.'], 403);
        }

        $recommendation = ExaminersRecommendation::where('form_id', $form->id)
            ->with('examiner')
            ->find($recommendation_id);

        if (!$recommendation) {
            return response()->json(['message' => 'No such examiner on this form'], 404);
        }

        if ($recommendation->recommendation !== 'pending') {
            return response()->json([
                'message' => 'This examiner has already been ' . $recommendation->recommendation . ' and cannot be removed.',
            ], 403);
        }

        $name = $recommendation->examiner?->name;
        $recommendation->delete();

        $form->addHistoryEntry('Supervisor removed ' . $name . ' from the ' . $recommendation->type . ' list', $user->name());
        $form->save();

        return response()->json(['message' => 'Examiner removed']);
    }

    public function submit(Request $request, $form_id)
    {
        $user = Auth::user();
        $role = $user->current_role;

        switch ($role->role) {
            case 'faculty':
                return $this->supervisorSubmit($user, $request, $form_id);
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'director':
                return $this->directorSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }


    private function supervisorSubmit($user, Request $request, $form_id)
    {

        $request->merge(['approval' => true]);
        return $this->submitForm($user, $request, $form_id, ListOfExaminersForm::class, 'faculty', 'faculty', 'hod', function ($formInstance) use ($request, $user) {

            $request->validate([
                'national' => 'array|required',
                'international' => 'array|required',
                'national.*.name' => 'required|string|max:255',
                'national.*.email' => 'required|email|max:255',
                'national.*.institution' => 'required|string|max:255',
                'national.*.designation' => 'required|string|max:255',
                'national.*.department' => 'required|string|max:255',
                'national.*.phone' => 'nullable|string|max:32',
                'international.*.name' => 'required|string|max:255',
                'international.*.email' => 'required|email|max:255',
                'international.*.institution' => 'required|string|max:255',
                'international.*.designation' => 'required|string|max:255',
                'international.*.department' => 'required|string|max:255',
                'international.*.phone' => 'nullable|string|max:32',
            ]);

            // An examiner is national or international, never both. Allowing
            // both stored two rows for one person, and DoRDC could only ever
            // decide one of them, leaving the form permanently pending.
            $onBothLists = array_intersect(
                $this->emailsOf($request->national),
                $this->emailsOf($request->international)
            );
            if ($onBothLists) {
                throw new \Exception(
                    'The same examiner appears on both lists: ' . implode(', ', array_unique($onBothLists))
                    . '. Each examiner belongs to one list only.'
                );
            }

            // Checked for both lists before either is written. processExaminers
            // creates rows as it goes and nothing here runs in a transaction, so
            // validating inside it would leave the national list saved when the
            // international one is refused.
            $this->refuseRepeatedLists($formInstance, [
                'national' => $request->national,
                'international' => $request->international,
            ]);

            $this->processExaminers($request->national, 'national', $formInstance, $user);

            $this->processExaminers($request->international, 'international', $formInstance, $user);

        });
    }

    private function hodSubmit($user, Request $request, $form_id)
    {

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            ListOfExaminersForm::class,
            'hod',
            'faculty',
            'dordc',
        );
    }

    /**
     * The Director's approval completes the form. The appointed panel is the
     * set of recommendations already marked approved, so there is nothing to
     * copy anywhere: `examiners_recommendation` is the record.
     */
    private function directorSubmit($user, Request $request, $form_id)
    {
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            ListOfExaminersForm::class,
            'director',
            'dordc',
            'complete'
        );
    }



    private function dordcSubmit($user, Request $request, $form_id)
    {
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            ListOfExaminersForm::class,
            'dordc',
            'hod',
            'director',
            function ($formInstance, $user) use ($request) {
                $request->validate([
                    'approvals' => 'array|required',
                    'approvals.*' => 'integer',
                    'rejections' => 'array|nullable',
                    'rejections.*' => 'integer',
                ]);

                $this->recordDecisions($formInstance, $request->approvals ?? [], 'approved', $user);
                $this->recordDecisions($formInstance, $request->rejections ?? [], 'rejected', $user);

                $examinersNationalCount = ExaminersRecommendation::where('form_id', $formInstance->id)
                    ->where('recommendation', 'approved')
                    ->where('type', 'national')
                    ->count();
                $examinersInternationalCount = ExaminersRecommendation::where('form_id', $formInstance->id)
                    ->where('recommendation', 'approved')
                    ->where('type', 'international')
                    ->count();
                $pendingExaminers = ExaminersRecommendation::where('form_id', $formInstance->id)
                    ->where('recommendation', 'pending')
                    ->count();
                if ($pendingExaminers > 0) {
                    throw new \Exception("All examiners must be either approved or rejected before the form can be submitted");
                }
                if ($request->approval && ($examinersNationalCount < self::REQUIRED_PER_LIST || $examinersInternationalCount < self::REQUIRED_PER_LIST)) {
                    $shortfall = 'At least ' . self::REQUIRED_PER_LIST
                        . ' approved examiners are required on each list. Approved so far: '
                        . $examinersNationalCount . ' national, ' . $examinersInternationalCount . ' international.';

                    // Hand it back the way a rejection does: same stage, same
                    // unlock, and the supervisor is notified. Hand-rolling this
                    // moved the form without telling anyone it had moved.
                    $formInstance->supervisor_approval = false;
                    $formInstance->supervisor_comments = null;
                    $this->handleFallbackToPreviousLevel($user, $formInstance, 'faculty', $shortfall, ListOfExaminersForm::class);

                    // The only way out of an extraSteps callback. The message is
                    // what DoRDC is shown.
                    throw new \Exception('Returned to the supervisor to add more examiners. ' . $shortfall);
                }
            }
        );
    }

    /**
     * Record DoRDC's verdict on each recommendation.
     *
     * Keyed by row id, not by email: an examiner's email is not unique within a
     * form, so an email-keyed update could only ever reach the first matching
     * row and left the other pending forever.
     */
    private function recordDecisions($formInstance, array $ids, string $verdict, $user): void
    {
        if (!$ids) {
            return;
        }

        $examiners = ExaminersRecommendation::where('form_id', $formInstance->id)
            ->whereIn('id', $ids)
            ->with('examiner')
            ->get();

        foreach ($examiners as $examiner) {
            if ($examiner->recommendation === $verdict) {
                continue;
            }
            $examiner->recommendation = $verdict;
            $examiner->save();
            $formInstance->addHistoryEntry(
                'DoRDC ' . $verdict . ' examiner ' . $examiner->examiner?->name,
                $user->name()
            );
        }
    }

    /**
     * Refuse a proposal that repeats too much of an earlier list.
     *
     * A supervisor sending the same panel to every scholar is the thing being
     * prevented, so the message names the scholar whose list is being repeated
     * and the people in common: without those there is nothing to act on.
     *
     * @param  array<string, array<int, array<string, mixed>>>  $lists  by type
     */
    private function refuseRepeatedLists($formInstance, array $lists): void
    {
        $student = $formInstance->student;
        if (!$student) {
            return;
        }

        $problems = [];

        foreach ($lists as $type => $examiners) {
            foreach (ExaminerOverlap::breaches($student, $type, $this->emailsOf($examiners ?? [])) as $breach) {
                $problems[] = 'the ' . $type . ' list repeats ' . count($breach['shared'])
                    . ' of the examiners already proposed for ' . $breach['roll_no']
                    . ' (' . implode(', ', $breach['shared']) . ')';
            }
        }

        if (!$problems) {
            return;
        }

        $share = (int) round(ExaminerOverlap::LIMIT * 100);

        throw new \Exception(
            'No more than ' . $share . '% of a list may be examiners already proposed for another scholar, but '
            . implode('; and ', $problems) . '. Replace the extra names.'
        );
    }

    /**
     * Emails as they are compared and stored: case and spacing are how the same
     * person slipped past the duplicate checks.
     *
     * @return array<int,string>
     */
    private function emailsOf(array $examiners): array
    {
        return array_map(
            fn ($examiner) => strtolower(trim((string) ($examiner['email'] ?? ''))),
            $examiners
        );
    }

    // Generalized function to process examiners
    private function processExaminers($examiners, $type, $formInstance, $user, $requiredCount = self::REQUIRED_PER_LIST)
    {
        if (!$examiners) {
            throw new \Exception(ucfirst($type) . ' Examiners are required');
        }
    
        // Check for duplicate examiners in the input
        $emails = $this->emailsOf($examiners);
        if (count($emails) !== count(array_unique($emails))) {
            throw new \Exception("Duplicate examiners found in the $type list");
        }
    
        $count = 0;
        foreach ($examiners as $examiner) {
            // The person goes into the shared directory; the form keeps only
            // which list they are on and what was decided about them.
            $directoryEntry = Examiner::fromDetails($examiner);

            $exists = ExaminersRecommendation::where('form_id', $formInstance->id)
                ->where('examiner_id', $directoryEntry->id)
                ->where('type', $type)
                ->first();
    
            if (!$exists) {
                ExaminersRecommendation::create([
                    'form_id' => $formInstance->id,
                    'examiner_id' => $directoryEntry->id,
                    'faculty_id' => $user->faculty->faculty_code,
                    'type' => $type,
                ]);
                $formInstance->addHistoryEntry("Supervisor added " . $directoryEntry->name . " to the " . $type . " list", $user->name());
                $count++;
            } else {
                if ($exists->recommendation != 'rejected') {
                    $count++;
                }
            }
        }
    
        if ($count < $requiredCount) {
            throw new \Exception("At least $requiredCount $type examiners are required");
        }
    }
    
}
