<?php

namespace App\Http\Controllers;

use App\Forms\SupervisorAllocationDefinition;
use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormCreate;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

use App\Models\Faculty;
use App\Models\Forms;
use App\Models\Supervisor;
use App\Support\SupervisionCapacity;
use App\Models\SupervisorAllocation;

use App\Support\FormLadder;

class SupervisorAllocationController extends Controller
{
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use GeneralFormCreate;
    use FilterLogicTrait;

    /**
     * Two chains, picked by how many supervisors the coordinator names.
     *
     * Up to two supervisors is the HOD's to settle. Three or more is a
     * commitment the department cannot make on its own, so the form carries on
     * to the DORDC and the Vice Chancellor.
     *
     * The first three steps are the same in both, so a form that switches chain
     * at the coordinator's step keeps its current_step and maximum_step.
     */
    private const CHAIN = ['student', 'phd_coordinator', 'hod', 'complete'];
    private const CHAIN_ABOVE_TWO_SUPERVISORS = ['student', 'phd_coordinator', 'hod', 'dordc', 'director', 'complete'];

    private function needsHigherApproval($formInstance): bool
    {
        return count($formInstance->supervisors ?? []) > 2;
    }

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("forms"));
    }
    public function listForm(Request $request, $student_id = null)
    {
        $user = Auth::user();
        if ($student_id)
            return $this->listFormsStudent($user, SupervisorAllocation::class, $student_id);
        return $this->listForms($user, SupervisorAllocation::class, $request, null, false, [
            'fields' => [
                "name",
                "roll_no",
                "area_preferences",
                "email"
            ],
            'extra_fields' => [
                // What the scholar asked to work in, which is what allocation
                // decides on. Progress was here and is 0 until presentations start.
                "area_preferences" => function ($form) {
                    return $form->student->areaPreferences->pluck('broad_area')->filter()->join(', ') ?: null;
                },
                "email" => function ($form) {
                    return $form->student->user->email;
                },
            ],
            'titles' => ["Name", "Roll No", "Area Preferences", "Email",],
        ]);
    }

    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $steps = self::CHAIN;
        if ($role->role != 'student') {
            return $this->refuse();
        }
        $data = [
            'roll_no' => $user->student->roll_no,
            'steps' => $steps,
            'role' => $role->role,
            'name' => $user->first_name . ' ' . $user->last_name
        ];
        return $this->createForms(SupervisorAllocation::class, $data);
    }

    public function loadForm(Request $request, $form_id = null)
    {
        $form_id = $this->routeParam($request, 'form_id', $form_id);
        $user = Auth::user();
        $role = $user->current_role;
        $model = SupervisorAllocation::class;
        switch ($role->role) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'phd_coordinator':
                return $this->handleCoordinatorForm($user, $form_id, $model);
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'director':
            case 'admin':
                return $this->handleAdminForm($user, $form_id, $model, true);

            // Reads the form, answers nothing. Not a step in the chain.
            case 'adordc':
                return $this->handleAdordcForm($user, $form_id, $model);
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
            case 'hod':
                return $this->hodSubmit($user, $request, $form_id);
            case 'phd_coordinator':
                return $this->coordinatorSubmit($user, $request, $form_id);
            case 'dordc':
                return $this->dordcSubmit($user, $request, $form_id);
            case 'director':
                return $this->directorSubmit($user, $request, $form_id);
            default:
                return $this->refuse();
        }
    }

    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $request->validate([
            'form_ids' => 'array|required',
        ]);
        if ($role->role != 'hod') {
            return $this->refuse();
        }
        $request->merge(['approval' => true]);
        return $this->bulkResults($request->form_ids, fn ($form_id) => $this->submit($request, $form_id));
    }

    /**
     * Allocate supervisors for many students at once from an uploaded sheet.
     *
     * Each row is funnelled through the ordinary coordinator submission so the
     * existing validation, authorization, locking, history and stage handling
     * all still apply, the forms land on the HOD exactly as they would have if
     * the coordinator had filled them in one at a time.
     */
    public function bulkAllocate(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;

        // Every row runs through coordinatorSubmit, which checks the acting
        // faculty against the scholar's department coordinator, so only a
        // phd_coordinator can pass it; admin used to be let in and fail every row.
        if ($role->role != 'phd_coordinator') {
            return $this->refuse();
        }

        $request->validate([
            'batch_data' => 'required|array',
            'batch_data.*.row_number' => 'required|integer',
            'batch_data.*.roll_no' => 'required',
            'batch_data.*.supervisors' => 'required|array|min:1',
        ]);

        $successCount = 0;
        $errorCount = 0;
        $errors = [];

        foreach ($request->batch_data as $row) {
            $rowNumber = $row['row_number'];

            try {
                $supervisors = collect($row['supervisors'])
                    ->map(fn($code) => trim((string) $code))
                    ->filter(fn($code) => $code !== '')
                    ->values()
                    ->all();

                if (empty($supervisors)) {
                    throw new \Exception('No supervisors provided');
                }

                // A coordinator filling in a sheet is far more likely to know a
                // supervisor's email than their numeric faculty code, so accept
                // either and normalise to the faculty code the form expects.
                $supervisors = array_map(function ($identifier) {
                    if (!str_contains($identifier, '@')) {
                        return $identifier;
                    }
                    $faculty = Faculty::whereHas('user', fn($q) => $q->where('email', $identifier))->first();
                    if (!$faculty) {
                        throw new \Exception("No faculty found with email {$identifier}");
                    }
                    return $faculty->faculty_code;
                }, $supervisors);

                $formInstance = SupervisorAllocation::where('student_id', $row['roll_no'])
                    ->where('completion', 'incomplete')
                    ->first();

                if (!$formInstance) {
                    throw new \Exception("No open supervisor allocation form found for roll number {$row['roll_no']}");
                }

                if (!in_array($formInstance->stage, ['student', 'phd_coordinator'])) {
                    throw new \Exception("Form for roll number {$row['roll_no']} is awaiting the '{$formInstance->stage}' stage and cannot be bulk allocated");
                }

                $rowRequest = new Request([
                    'supervisors' => $supervisors,
                    'approval' => true,
                ]);
                $rowRequest->setUserResolver($request->getUserResolver());

                $response = $this->coordinatorSubmit($user, $rowRequest, $formInstance->id);

                if ($response->getStatusCode() >= 400) {
                    $payload = $response->getData(true);
                    throw new \Exception($payload['message'] ?? 'Allocation failed');
                }

                $successCount++;
            } catch (\Exception $e) {
                $errorCount++;
                $errors[] = "Row {$rowNumber}: " . $e->getMessage();
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Allocation completed: {$successCount} allocated, {$errorCount} errors",
            'data' => [
                'success_count' => $successCount,
                'error_count' => $errorCount,
                'errors' => $errors,
            ],
        ], 200);
    }

    private function studentSubmit($user, $request, $form_id)
    {
        $model = SupervisorAllocation::class;

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'student',
            'student',
            'phd_coordinator',
            function ($formInstance) use ($request, $user) {
                // Faculty codes only: anything else reached array_unique() below
                // and surfaced as "Array to string conversion".
                $request->validate((new SupervisorAllocationDefinition)->rules('student', $formInstance->fullForm($user)));
                $prefrences = array_values(array_filter($request->prefrences, fn ($code) => $code !== null));
                if (count($prefrences) != 6 || count(array_unique($prefrences)) != 6) {
                    throw new \Exception("Please choose six different supervisors.");
                }
                $i = 1;
                foreach ($prefrences as $prefrence) {
                    if (!Faculty::find($prefrence)) {
                        throw new \Exception("One of the chosen supervisors is not in the faculty list.");
                    }
                }
                $formInstance->prefrences = $prefrences;
                // The scholar's own words. They are describing what they hope
                // to work on, so this is not restricted to a list: the whole
                // point of the step is to find supervisors for whatever they
                // are interested in. It used to be stored as rows in a shared
                // table that doubled as every department's area list, which is
                // how one scholar's typing became everyone else's suggestions.
                $areas = collect($request->broad_area_of_research)
                    ->map(fn ($area) => trim(preg_replace('/\s+/', ' ', (string) $area)))
                    ->filter()
                    ->unique(fn ($area) => strtolower($area))
                    ->values();

                $formInstance->student->areaPreferences()->delete();
                foreach ($areas as $area) {
                    $formInstance->student->areaPreferences()->create([
                        'broad_area' => $area,
                        'student_id' => $formInstance->student_id,
                    ]);
                }
            }
        );
    }
    private function coordinatorSubmit($user, $request, $form_id)
    {
        $model = SupervisorAllocation::class;

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'phd_coordinator',
            'student',
            'hod',
            function ($formInstance) use ($request, $user) {
                $request->validate((new SupervisorAllocationDefinition)->rules('phd_coordinator', $formInstance->fullForm($user)));
                $supervisors = $request->supervisors;
                if (count($supervisors) != count(array_unique($supervisors))) {
                    throw new \Exception("Please select unique supervisors");
                }
                foreach ($supervisors as $supervisor) {
                    if (!Faculty::find($supervisor)) {
                        throw new \Exception("Invalid supervisor selected");
                    }
                }
                $formInstance->supervisors = $supervisors;
                // Set on every coordinator submission, not only the first, so a
                // form sent back and re-allocated with fewer supervisors drops
                // the extra steps again.
                $formInstance->steps = count($supervisors) > 2
                    ? self::CHAIN_ABOVE_TWO_SUPERVISORS
                    : self::CHAIN;
            }
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $model = SupervisorAllocation::class;
        $form = SupervisorAllocation::find($form_id);
        if (!$form) {
            return response()->json(['message' => 'No form found'], 404);
        }

        $next = $this->needsHigherApproval($form) ? 'dordc' : 'complete';

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'hod',
            'phd_coordinator',
            $next,
            function ($formInstance) use ($request, $user, $next) {
                if ($request->approval && $next === 'complete') {
                    $this->applyAllocation($formInstance, $user, 'HOD');
                }
            }
        );
    }

    private function dordcSubmit($user, $request, $form_id)
    {
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            SupervisorAllocation::class,
            'dordc',
            'hod',
            'director'
        );
    }

    private function directorSubmit($user, $request, $form_id)
    {
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            SupervisorAllocation::class,
            'director',
            'dordc',
            'complete',
            function ($formInstance) use ($request, $user) {
                if ($request->approval) {
                    $this->applyAllocation($formInstance, $user, 'Vice Chancellor');
                }
            }
        );
    }

    /**
     * Write the allocation and open the forms it unlocks.
     *
     * Called by whoever holds the last step: the HOD for two supervisors or
     * fewer, the Vice Chancellor for three or more. Doing it any earlier would
     * pair a scholar with a supervisor the chain has not finished approving.
     */
    private function applyAllocation($formInstance, $user, string $approvedBy)
    {
        $formInstance->status = 'approved';

        $supervisors = $formInstance->supervisors;

        // The last point where a supervisor can still be swapped. Checked here
        // rather than at the coordinator's stage because this is where the
        // commitment is actually written, and a scholar allocated last week may
        // have filled the supervisor's last slot since.
        foreach ($supervisors as $supervisor) {
            $faculty = Faculty::find($supervisor);
            if (!$faculty) {
                continue;
            }

            $capacity = SupervisionCapacity::describe($faculty);
            if ($capacity['is_full']) {
                throw new \Exception(
                    $faculty->user?->name() . ' already guides ' . $capacity['current']
                    . ' scholars, which is the limit for a ' . $faculty->designation
                    . '. Send the form back so another supervisor can be chosen.'
                );
            }
        }

        // A supervisor the scholar already has stays as they are. The
        // coordinator's panel starts from the current list, so a re-allocation
        // carried existing pairs and failed on the unique key.
        foreach ($supervisors as $supervisor) {
            Supervisor::firstOrCreate([
                'student_id' => $formInstance->student_id,
                'faculty_id' => $supervisor,
            ]);
        }

        FormLadder::open($formInstance->student, 'supervisor-allocation');

        $formInstance->addHistoryEntry("Supervisors allocated by {$approvedBy}", $user->name());
    }
}
