<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use Illuminate\Http\Request;
use App\Http\Controllers\Traits\GeneralFormHandler;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\GeneralFormSubmitter;
use App\Http\Controllers\Traits\HasSemesterCodeValidation;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\Traits\SaveFile;

use App\Models\Patent;
use App\Models\Presentation;
use App\Models\PresentationReview;
use App\Models\Publication;
use App\Models\Semester;
use App\Models\Student;
use App\Services\PresentationService;

use Carbon\Carbon;

class PresentationController extends Controller
{
    use GeneralFormHandler;
    use GeneralFormSubmitter;
    use GeneralFormList;
    use SaveFile;
    use FilterLogicTrait;
    use HasSemesterCodeValidation;
    use GeneralFormList;
    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("presentation"));
    }
    public function listForm(Request $request, $semester_id = null)
    {
        $user = Auth::user();
        $filters = $request->input('filters', null);
        $filtersJson = $request->query('filters');
    
        if ($filtersJson) {
            $filters = json_decode(urldecode($filtersJson), true);
        }
    
        $validator = $this->validateSemesterCode($semester_id);
        if (!$validator['valid']) {
            return response()->json(['message' => 'Invalid Semester Code'], 422);
        }

        if ($user->current_role->role === 'student' && $semester_id && !empty($validator['current'])) {
            $existing = Presentation::where('student_id', $user->student->roll_no)
                ->where('semester_id', $validator['semester_id'])
                ->exists();
            if (!$existing) {
                Presentation::create([
                    'student_id' => $user->student->roll_no,
                    'period_of_report' => $semester_id,
                    'semester_id' => $validator['semester_id'],
                    'status' => 'pending',
                    'completion' => 'incomplete',
                    'steps' => ['student', 'faculty', 'doctoral', 'hod', 'adordc', 'dordc', 'dra', 'complete'],
                ]);
            }
        }
    
        $mandatoryFilter = $filters['mandatory_filter'] ?? null;
        $parsedFilters = [];
        if (is_array($mandatoryFilter)) {
            $parsedFilters = $this->is_assoc($mandatoryFilter) ? [$mandatoryFilter] : $mandatoryFilter;
        }
     
        $isMissing = collect($parsedFilters)->contains(function ($filter) {
            return isset($filter['key'], $filter['value']) &&
                $filter['key'] === 'missed' &&
                (string)$filter['value'] === '1';
        });
          
        $isUpcoming = collect($parsedFilters)->contains(function ($filter) {
            return isset($filter['key'], $filter['value']) &&
                $filter['key'] === 'upcoming' &&
                (string)$filter['value'] === '1';
        });

        $isAction = collect($parsedFilters)->contains(function ($filter) {
            return isset($filter['key'], $filter['value']) &&
                $filter['key'] === 'action' &&
                (string)$filter['value'] === '1';
        });

        if($isAction){
            $parsedFilters = array_values(array_filter($parsedFilters, function ($filter) {
                return !(isset($filter['key'], $filter['value']) &&
                    $filter['key'] === 'action' &&
                    in_array($filter['value'], ['1', 1], true));
            }));            

            $role = $user->current_role->role;
            if($role == 'faculty') $role = 'supervisor';

            // Existing condition
            $mandatoryFilters[] = [
                'key' => $role.'_lock',
                'op' => '=',
                'value' => 0
            ];

            $presentationIds = \App\Models\PresentationReview::where('faculty_id', $user->faculty->faculty_code)
                ->where('review_status', 'pending')
                ->pluck('presentation_id')
                ->toArray();

            if (!empty($presentationIds)) {
                $mandatoryFilters[] = [
                    'key' => 'id',
                    'op' => 'in',
                    'value' => $presentationIds
                ];
            } else {
                $mandatoryFilters[] = [
                    'key' => 'id',
                    'op' => '=',
                    'value' => -1
                ];
            }
        }

        $titles = ["Name", "Roll No", "Date", "Time", "Progress %", "Supervisors"];
        $fields = ["name", "roll_no", "date", "time", "progress", "supervisors"];
        $mandatoryFilters = [];
    
        if ($isMissing) {
            $mandatoryFilters[] = [
                'key' => 'date',
                'op' => '<',
                'value' => Carbon::now()->format('Y-m-d')
            ];
            $mandatoryFilters[] = [
                'key' => 'leave',
                'op' => '=',
                'value' => 0
            ];
            $titles = ["Name", "Roll No", "Date", "Time", "Supervisors"];
            $fields = ["name", "roll_no", "date", "time", "supervisors"];
        }
       
    
        if ($isUpcoming) {      
            $parsedFilters = array_values(array_filter($parsedFilters, function ($filter) {
                return !(isset($filter['key'], $filter['value']) &&
                    $filter['key'] === 'upcoming' &&
                    in_array($filter['value'], ['1', 1], true));
            }));            
    
            $mandatoryFilters[] = [
                'key' => 'date',
                'op' => '>=',
                'value' => Carbon::now()->format('Y-m-d')
            ];
            $mandatoryFilters[] = [
                'key' => 'leave',
                'op' => '=',
                'value' => 0
            ];
            $mandatoryFilters[] = [
                'key' => 'missed',
                'op' => '=',
                'value' => 1
            ];
            $titles = ["Name", "Roll No", "Date", "Time", "Meet Link", "Supervisors"];
            $fields = ["name", "roll_no", "date", "time", "venue", "supervisors"];
        }
        
        if($isAction){
            $parsedFilters = array_values(array_filter($parsedFilters, function ($filter) {
                return !(isset($filter['key'], $filter['value']) &&
                    $filter['key'] === 'action' &&
                    in_array($filter['value'], ['1', 1], true));
            }));            
            $role= $user->current_role->role;
            if($role=='faculty')$role='supervisor';
            $mandatoryFilters[] = [
                'key' => $role.'_lock',
                'op' => '=',
                'value' => 0
            ];
          }

       
       
          if ($semester_id) {
            $mandatoryFilters[] = [
                'key' => 'period_of_report',
                'op' => '=',
                'value' => $semester_id
            ];
        }
    
        if(!empty($parsedFilters) || !empty($mandatoryFilters)){
            $filters = $filters ?? [];
            $filters['mandatory_filter'] = array_merge($parsedFilters, $mandatoryFilters);
            $request->merge(['filters' => $filters]);    
        }
     
        if (!$semester_id) {
            $titles[] = "Semester";
            $fields[] = "period";
        }
    
        return $this->listForms($user, Presentation::class, $request, $filters, true, [
            'fields' => $fields,
            'titles' => $titles,
            'extra_fields' => [
                "overall_progress" => function ($form) {
                    return $form->student->overall_progress;
                },
                "progress" => function ($form) {
                    return $form->progress;
                },
                "supervisors" => function ($form) {
                    return $form->student->supervisors->map(function ($supervisor) {
                        return $supervisor->user->name();
                    })->join(', ');
                },
                "phone" => function ($form) {
                    return $form->student->user->phone;
                },
                "date" => function ($form) {
                    return $form->date;
                },
                "time" => function ($form) {
                    return $form->time;
                },
                "period" => function ($form) {
                    return $form->period_of_report;
                },
                "venue" => function ($form) {
                    return $form->venue;
                },
            ],
        ]);
    }
    

    

    // Helper to check if array is associative
    private function is_assoc(array $arr): bool
    {
        return array_keys($arr) !== range(0, count($arr) - 1);
    }


    public function createForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $cur = $role->role;
        if ($cur == 'faculty' || $cur == 'phd_coordinator' || $cur == 'student') {
            $request->validate([
                'student_id' => 'required|string',
                'date' => 'required|date',
                'time' => 'required|string',
                'period_of_report' => 'required|string',
                'guest_emails' => 'nullable|array',
                'guest_emails.*' => 'email',
                'venue' => 'nullable|string',
            ]);
            $validator = $this->validateSemesterCode($request->period_of_report);
            if (!$validator['valid']) {
                return response()->json(['message' => 'Invalid Semester Code'], 422);
            }
            if (!$validator['current'] && !$validator['upcoming'] && !$validator['in_db']) {
                return response()->json(['message' => 'Presentation cannot be scheduled for Past Semester'], 422);
            }

            $student = Student::where('roll_no', $request->student_id)->first();
            if (!$student) {
                return response()->json(['message' => 'Student not found'], 404);
            }
            if ($cur == 'student') {
                if ($student->roll_no !== $user->student->roll_no) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
            } else {
                if (!$student->checkSupervises($user->faculty->faculty_code) && !$student->department->checkCoordinates($user->faculty->faculty_code)) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
            }
            $old = Presentation::where('student_id', $request->student_id)->where('semester_id', $validator['semester_id'])->get();
            if (count($old) != 0) {
                return response()->json(['message' => 'Presentation already scheduled for this period'], 403);
            }

            $emails = $this->emailList($student, $request);
            $form = Presentation::create([
                'student_id' => $request->student_id,
                'date' => Carbon::createFromFormat('Y-m-d', $request->date)->format('Y-m-d'),
                'time' => $request->time,
                'period_of_report' => $request->period_of_report,
                'status' => 'pending',
                'ppt_file' => $validator['ppt_file'],
                'completion' => 'incomplete',
                'semester_id' => $validator['semester_id'],
                'total_progress'=> $student->overall_progress,
                'steps' => ['student', 'faculty', 'doctoral', 'hod','adordc', 'dordc', 'dra', 'complete'],
            ]);
            if(!$request->venue){
                $form->venue = 'TBD';
            }
            else{
                $form->venue = $request->venue;
            }
            $form->save();
            $actionBy = $cur == 'student' ? 'Student' : 'Supervisor';
            $form->addHistoryEntry("Presentation Scheduled by $actionBy", $user->first_name);
            return response()->json($form);
        }
        return response()->json(['message' => 'You are not authorized to access this resource'], 403);
    }

    public function listSemesterPresentation(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $cur = $role->role;

    
            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 10);

            // Exclude current/active and upcoming semesters - only show completed ones
            $currentDate = now();
            $query = Semester::where('end_date', '<', $currentDate)
                ->orderBy('year', 'desc')
                ->orderBy('semester', 'desc');

            $total = $query->count();
            $totalPages = ceil($total / $perPage);

            $semesters = $query->paginate($perPage, ['*'], 'page', $page)->getCollection();

            $data = collect($semesters)->map(function ($semester) {
                return [
                    'semester_name' => $semester->semester_name,
                    'start_date' => Carbon::parse($semester->start_date)->format('d/m/Y'),
                    'end_date' => Carbon::parse($semester->end_date)->format('d/m/Y'),
                    'semester' => $semester->semester,
                    'year' => $semester->year,
                ];
            });

            return response()->json([
                'data' => $data->values(),
                'page' => (int) $page,
                'total' => $total,
                'totalPages' => $totalPages,
                'fields' => ["semester_name", "start_date", "end_date", "semester", "year"],
                'fieldsTitles' => ["Semester Name", "Start Date", "End Date", "Semester", "Year"],
                'role' => $role->role,
            ]);      
    }


    public function markLeave(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $cur = $role->role;
        if ($cur == 'student') {
            $request->validate([
                'period_of_report' => 'required|string',
                'leave' => 'required|boolean',
            ]);
            $validator = $this->validateSemesterCode($request->period_of_report);
            if (!$validator['valid']) {
                return response()->json(['message' => 'Invalid Semester Code'], 422);
            }
            if (!$validator['current'] && !$validator['upcoming'] && !$validator['in_db']) {
                return response()->json(['message' => 'Presentation cannot be scheduled for Past Semester'], 422);
            }

            $student = Student::where('roll_no', $request->student_id)->first();
            if (!$student) {
                return response()->json(['message' => 'Student not found'], 404);
            }
            $old = Presentation::where('student_id', $request->student_id)->where('semester_id', $validator['semester_id'])->get()->first();
            if (count($old) != 0) {
                $old->leave = $request->leave;
                $old->save();
                $emails = $this->emailList($student, $request);
                //send calendar event cancellation email
                return response()->json(['message' => 'Leave marked successfully'], 200);
            } else {
                $form = Presentation::create([
                    'student_id' => $request->student_id,
                    'date' => $request->date,
                    'time' => $request->time,
                    'period_of_report' => $request->period_of_report,
                    'status' => 'pending',
                    'completion' => 'incomplete',
                    'semester_id' => $validator['semester_id'],
                    'steps' => ['student', 'faculty', 'doctoral', 'hod','adordc', 'dordc', 'dra', 'complete'],
                ]);
            }
        } else {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    public function createMultipleForm(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $cur = $role->role;

        if ($cur != 'faculty' && $cur != 'phd_coordinator') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        $request->validate([
            'semester' => 'required|string',
            'students' => 'required|array',
            'students.*.student_id' => 'required|integer',
            'students.*.date' => 'required|string',
            'students.*.time' => 'required|string',
            'students.*.guest_emails' => 'nullable|array',
        ]);
        $validator = $this->validateSemesterCode($request->semester);
        if (!$validator['valid']) {
            return response()->json(['message' => 'Invalid Semester Code'], 422);
        }
        if (!$validator['current'] && !$validator['upcoming'] && !$validator['in_db']) {
            return response()->json(['message' => 'Presentation cannot be scheduled for Past Semester'], 422);
        }

        $createdForms = [];
        $errors = [];

        foreach ($request->students as $studentData) {
            $student = Student::where('roll_no', $studentData['student_id'])->first();
        
            $formattedDate =  Carbon::createFromFormat('Y-m-d',$studentData['date'])->format('Y-m-d');
            if (!$student) {
                $errors[] = ['student_id' => $studentData['student_id'], 'message' => 'Student not found'];
                continue;
            }

            if (!$student->checkSupervises($user->faculty->faculty_code) && !$student->department->checkCoordinates($user->faculty->faculty_code)) {
                $errors[] = ['student_id' => $studentData['student_id'], 'message' => 'Not authorized to schedule for student '];
                continue;
            }

            $existingPresentation = Presentation::where('student_id', $studentData['student_id'])
                ->where('semester_id', $validator['semester_id'])
                ->exists();

            if ($existingPresentation) {
                $errors[] = ['student_id' => $studentData['student_id'], 'message' => 'Presentation already scheduled for this period'];
                continue;
            }

            $form = Presentation::create([
                'student_id' => $studentData['student_id'],
                'semester_id' => $validator['semester_id'],
                'period_of_report' => $studentData['period_of_report'],
                'leave' => $studentData['leave'] ?? false,
                'status' => 'pending',
                'ppt_file' => $validator['ppt_file'],
                'completion' => 'incomplete',
                'steps' => ['student', 'faculty', 'doctoral', 'hod','adordc', 'dordc', 'dra', 'complete'],
            ]);

            $emails = $this->emailList($student, $request);
            $form->venue = $studentData['venue'] ?? 'TBD';
            $form->addHistoryEntry("Presentation Scheduled by Supervisor", $user->first_name);
            $createdForms[] = $form;
        }
        if ($errors) {
            return response()->json([
                'created_forms' => $createdForms,
                'errors' => $errors,
            ], 422);
        }
        return response()->json([
            'created_forms' => $createdForms,
            'errors' => $errors,
        ]);
    }
    public function loadForm(Request $request, $semester_id=null,$form_id = null)
    {
        $user = Auth::user();
        $steps = ['student', 'faculty', 'doctoral', 'hod', 'dra', 'adordc','dordc','dra', 'complete'];
        $model = Presentation::class;
        $form = Presentation::find($form_id);
        $role = $user->current_role;
        $cur = $role->role;
        if ($form) {
            if ($form->student->checkDoctoralCommittee($user->faculty?->faculty_code)) {
                $cur = 'doctoral';
            }
        }
        switch ($cur) {
            case 'student':
                return $this->handleStudentForm($user, $form_id, $model, $steps);
            case 'hod':
                return $this->handleHodForm($user, $form_id, $model);
            case 'doctoral':
            case 'external':
                return $this->handledoctoralForm($user, $form_id, $model);
            case 'dra':
            case 'dordc':
                return $this->handleAdminForm($user, $form_id, $model);
            case 'adordc':
                return $this->handleAdordcForm($user, $form_id, $model, false);
            case 'faculty':
                return $this->handleFacultyForm($user, $form_id, $model);
            case 'admin':
                return $this->handleAdminForm($user, $form_id, $model, true);

            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    public function submit(Request $request, $semester_id=null,$form_id)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $form = Presentation::find($form_id);

        if (!$form && $user->current_role->role === 'student') {
            // Auto create presentation
            $validator = $this->validateSemesterCode($request->period_of_report);

            if (!$validator['valid']) {
                return response()->json(['message' => 'Invalid Semester Code'], 422);
            }

            $form = Presentation::create([
                'student_id' => $user->student->roll_no,
                'period_of_report' => $request->period_of_report,
                'semester_id' => $validator['semester_id'],
                'status' => 'pending',
                'completion' => 'incomplete',
                'steps' => ['student', 'faculty', 'doctoral', 'hod','adordc','dordc','dra','complete'],
            ]);
        }

        $cur = $role->role;
        if ($form) {
            if ($form->student->checkDoctoralCommittee($user->faculty?->faculty_code)) {
                $cur = 'doctoral';
            }
        }
        switch ($cur) {
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
            case 'adordc':
                return $this->adordcSubmit($user, $request, $form_id);
            case 'doctoral':
                return $this->doctoralSubmit($user, $request, $form_id);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }

    public function bulkSubmit(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role;
        $allowedRoles = ['hod', 'dra', 'dordc', 'doctoral','adordc'];
        if (!in_array($role->role, $allowedRoles)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $request->validate([
            'form_ids' => 'required|array',
            'form_ids.*' => 'exists:presentations,id',
        ]);
        
  
        foreach ($request->form_ids as $form_id) {
            $this->submit($request,null, $form_id);
        }
        
        return response()->json(['message' => 'Forms submitted successfully'], 200);
    }

    public function linkPublication(Request $request,$semester_id=null, $form_id)
    {
        try {
            $user = Auth::user();
            $role = $user->current_role;
            if ($role->role != 'student') {
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
            }
            $formInstance = Presentation::find($form_id);
            if (count($request->publications) != 0) {
                foreach ($request->publications as $publication) {
                    $publication = Publication::find($publication);
                    if (!$publication) {
                        throw new \Exception("Invalid publication selected");
                    }
                    if ($publication->student_id != $user->student->roll_no) {
                        throw new \Exception("Invalid publication selected");
                    }
                    $existingPublication = Publication::where('title', $publication->title)
                        ->where('form_id', $formInstance->id)
                        ->where('publication_type', $publication->publication_type)
                        ->where('form_type', 'progress')
                        ->first();
                    if ($existingPublication) {
                        throw new \Exception("Publication with the same title already linked to this form");
                    }
                    $newPublication = $publication->replicate();
                    $newPublication->form_id = $formInstance->id;
                    $newPublication->form_type = 'progress';

                    $newPublication->save();
                }
            }
            if (count($request->patents) != 0) {
                foreach ($request->patents as $patent) {
                    $patent = Patent::find($patent);
                    if (!$patent) {
                        throw new \Exception("Invalid patent selected");
                    }
                    if ($patent->student_id != $user->student->roll_no) {
                        throw new \Exception("Invalid patent selected");
                    }
                    $existingPatent = Patent::where('title', $patent->title)
                        ->where('form_id', $formInstance->id)
                        ->where('form_type', 'progress')
                        ->first();
                    if ($existingPatent) {
                        throw new \Exception("Patent with the same title  already linked to this form");
                    }
                    $newPatent = $patent->replicate();
                    $newPatent->form_id = $formInstance->id;
                    $newPatent->form_type = 'progress';
                    $newPatent->save();
                }
            }
            return response()->json(['message' => 'Publications linked to Presentation'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function unlinkPublication(Request $request,$semester_id=null, $form_id)
    {
        $user = Auth::user();
        $role = $user->current_role;
        if ($role->role != 'student') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
        $formInstance = Presentation::find($form_id);
        if (count($request->publications) != 0) {
            foreach ($request->publications as $publication) {
                $publication = Publication::where('id', $publication)->where('form_id', $formInstance->id)->where('form_type', 'progress');
                $publication->delete();
            }
        }
        if (count($request->patents) != 0) {
            foreach ($request->patents as $patent) {
                $patent = Patent::where('id', $patent)->where('form_id', $formInstance->id)->where('form_type', 'progress');
                $patent->delete();
            }
        }
        return response()->json(['message' => 'Publications unlinked from Presentation'], 200);
    }

    private function studentSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;

        $formInstance = Presentation::find($form_id);
        if (!$formInstance) {
            throw new \Exception("Presentation not found. Please try again.");
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
                $request->validate([
                    'teaching_work' => 'required| in:UG,PG,Both,None',
                    'presentation_pdf' => 'required|file|mimes:pdf|max:2048',
                ]);


                $formInstance->teaching_work = $request->teaching_work;
                // $formInstance->no_paper_sci_journal=$request->no_paper_sci_journal;
                // $formInstance->no_paper_scopus_journal=$request->no_paper_scopus_journal;
                // $formInstance->no_paper_conference=$request->no_paper_conference;

                $formInstance->presentation_pdf = $this->saveUploadedFile($request->file('presentation_pdf'), 'presentation_pdf', $user->student->roll_no);
                $formInstance->missed=0;

                $formInstance->supervisor_lock = 0;

                $sups = $user->student->supervisors;
                foreach ($sups as $sup) {
                    PresentationReview::create([
                        'presentation_id' => $formInstance->id,
                        'faculty_id' => $sup->faculty_code,
                        'comments' => '',
                        'review_status' => 'pending',
                        'is_supervisor' => 1,
                    ]);
                }
            }
        );
    }

    private function supervisorSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'faculty',
            'student',
            'doctoral',
            function ($formInstance) use ($request, $user) {
                if (!$formInstance->progress || !$formInstance->attendance || !$formInstance->contact_hours) {
                    $request->validate([
                        'progress' => 'required|integer|min:0|max:100',
                        'attendance' => 'required|numeric|min:0|max:100',
                        'contact_hours' => 'required|integer|min:0',
                    ]);
                    $formInstance->progress = $request->progress;
                    $formInstance->attendance = $request->attendance;
                    $formInstance->contact_hours = $request->contact_hours;
                    $formInstance->current_progress = $formInstance->student->overall_progress;
                    $formInstance->total_progress = $formInstance->student->overall_progress + $request->progress;
                    $formInstance->save();
                }
                $alreadyReviewed = PresentationReview::where('presentation_id', $formInstance->id)->where('faculty_id', $user->faculty->faculty_code)->first();

                if ($alreadyReviewed->review_status == 'completed') {
                    throw new \Exception("You have already reviewed this form");
                }

                if ($request->approval) {
                    $formInstance->addHistoryEntry("Supervisor Submitted", $user->name(),$request->comments);
                    PresentationReview::where('presentation_id', $formInstance->id)->where('is_supervisor', 1)->where('faculty_id', $user->faculty->faculty_code)
                        ->update(['progress' => 'satisfactory', 'review_status' => 'completed', 'comments' => $request->comments]);
                    $approvals = PresentationReview::where('presentation_id', $formInstance->id)->where('is_supervisor', 1)->where('review_status', 'pending')->get();
                    if (count($approvals) != 0) {
                        throw new \Exception("Your Prefrences have been saved. Please wait for other supervisors to approve", 201);
                    } else {
                        $doctoral = $formInstance->student->doctoralCommittee;
                        foreach ($doctoral as $doc) {
                            PresentationReview::create([
                                'presentation_id' => $formInstance->id,
                                'faculty_id' => $doc->faculty_code,
                                'comments' => '',
                                'review_status' => 'pending',
                                'is_supervisor' => 0,
                            ]);
                        }
                    }
                }
            }
        );
    }

    private function doctoralSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;

        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'doctoral',
            'faculty',
            'hod',
            function ($formInstance) use ($request, $user) {
                $alreadyReviewed = PresentationReview::where('presentation_id', $formInstance->id)->where('is_supervisor', 0)->where('faculty_id', $user->faculty->faculty_code)->first();

                if ($alreadyReviewed->review_status == 'completed') {
                    throw new \Exception("You have already reviewed this form");
                }

                if ($request->approval) {
                    $formInstance->addHistoryEntry("Doctoral Committee Submitted", $user->name(),$request->comments);
               
                    PresentationReview::where('presentation_id', $formInstance->id)->where('faculty_id', $user->faculty->faculty_code)
                        ->update(['progress' => 'satisfactory', 'review_status' => 'completed', 'comments' => $request->comments]);
                }
                else{
                    PresentationReview::where('presentation_id', $formInstance->id)->where('faculty_id', $user->faculty->faculty_code)
                        ->update(['progress' => 'not satisfactory', 'review_status' => 'completed', 'comments' => $request->comments]);
                }
                $approvals = PresentationReview::where('presentation_id', $formInstance->id)->where('is_supervisor', 0)->where('review_status', 'pending')->get();
              
                if (count($approvals) != 0) {
                    throw new \Exception("Your Prefrences have been saved. Please wait for other supervisors to approve", 201);
                }
                
            }
        );
    }

    private function hodSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'hod',
            'faculty',
            'adordc',
        );
    }
    private function adordcSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'adordc',
            'hod',
            'dordc',
        );
    }
    private function dordcSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'dordc',
            'adordc',
            'dra',
        );
    }

    private function draSubmit($user, $request, $form_id)
    {
        $model = Presentation::class;
        return $this->submitForm(
            $user,
            $request,
            $form_id,
            $model,
            'dra',
            'dordc',
            'complete',
            function ($formInstance) use ($request, $user) {
                $formInstance->completion = 'complete';
                $formInstance->status = 'approved';
                $formInstance->student->overall_progress = $formInstance->total_progress;
                $formInstance->student->save();
                $formInstance->addHistoryEntry("Presentation marked as completed by DRA", $user->name());
            }
        );
    }

    private function emailList($student, $request)
    {
        $emails = [];

        $supervisorEmails = $student->supervisors?->map(function ($supervisor) {
            return $supervisor->user?->email;
        })->filter()->values()->all() ?? [];
        $emails = array_merge($emails, $supervisorEmails);

        $guestEmails = is_array($request->guest_emails) ? array_filter($request->guest_emails) : [];
        $emails = array_merge($emails, $guestEmails);

        $committeeEmails = $student->doctoralCommittee?->map(function ($supervisor) {
            return $supervisor->user?->email;
        })->filter()->values()->all() ?? [];

        $emails = array_merge($emails, $committeeEmails);


        $coordinatorEmails = $student->department?->phdCoordinators?->pluck('email')->filter()->values()->all() ?? [];
        $emails = array_merge($emails, $coordinatorEmails);


        $hodEmail = optional($student->department?->hod?->user)->email;
        if ($hodEmail) {
            $emails[] = $hodEmail;
        }

        // Student's own email
        $studentEmail = optional($student->user)->email;
        if ($studentEmail) {
            $emails[] = $studentEmail;
        }

        $emails = array_values(array_filter(array_unique($emails)));
        return $emails;
    }
}
