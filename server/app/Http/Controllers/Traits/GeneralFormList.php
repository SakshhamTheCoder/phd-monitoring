<?php

namespace App\Http\Controllers\Traits;

// use App\Http\Traits\FilterLogicTrait;

use App\Models\Student;
use App\Http\Controllers\Traits\FilterLogicTrait;

trait GeneralFormList
{
    use FilterLogicTrait;
    use PagenationTrait;
    private function listForms($user, $model, $request, $filters = null, $override = false, $fields = [])
    {
        $role = $user->current_role->role;
        $page = $request->input('page', 1);
        $rows = $request->input('rows', 50);
        // $filters= $request->input('filters', null);
        if (!$filters) {
            $filtersJson = $request->query('filters');
            if ($filtersJson) {
                $filters = json_decode(urldecode($filtersJson), true);
            }
        }
        // else 
        // echo json_encode($filters);


        switch ($role) {
            case 'student':
                return $this->listStudentForms($user, $model, $filters, $page, $rows, $fields);
            case 'hod':
            case 'phd_coordinator':
                return $this->listHodForms($user, $model, $filters, false, $page, $rows, $fields,);
            case 'dra':
            case 'dordc':
            case 'director':
            case 'admin':
                return $this->listAdminForms($user, $model, $filters, $page, $rows, $fields,);
            case 'faculty':
                return $this->listFacultyForms($user, $model, $filters, $override, $page, $rows, $fields);
            case 'adordc':
                return $this->listAdordcForms($user, $model, $filters, $page, $rows, $fields);
            case 'doctoral':
            case 'external':
                return $this->listDoctoralForms($user, $model, $filters, $override, $page, $rows, $fields,);
            default:
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    }




    private function paginateAndMap($formsQuery, $page, $fields, $perPage = 50, $user)
    {
        $total = $formsQuery instanceof \Illuminate\Database\Eloquent\Builder || $formsQuery instanceof \Illuminate\Database\Query\Builder
            ? $formsQuery->count()
            : count($formsQuery);
        $totalPages = ceil($total / $perPage);

        $forms = $this->applyPagination($formsQuery, $page, $perPage);

        if ($forms instanceof \Illuminate\Database\Eloquent\Builder || $forms instanceof \Illuminate\Database\Query\Builder) {
            $forms = $forms->get();
        }

        return [
            'data' => collect($forms)->map(fn($form) => $this->mapForm($form, $fields['extra_fields'] ?? []))->values(),
            'page' => $page,
            'total' => $total,
            'totalPages' => $totalPages,
            'fields' => $fields['fields'] ?? [],
            'fieldsTitles' => $fields['titles'] ?? [],
            'role' => $user->current_role->role,
        ];
    }


    private function mapForm($form, $fields = [])
    {
        $formData = [
            'name' => $form->student->user->name(),
            'stage' => $form->stage,
            'roll_no' => $form->student->roll_no,
            'status' => $form->status,
            'completion' => $form->completion,
            'created_at' => $form->created_at,
            'updated_at' => $form->updated_at,
            'action_req' => $form->student_lock,
            'id' => $form->id,
        ];

        foreach ($fields as $key => $field) {
            if (is_string($field) && isset($form->$field)) {
                $formData[$field] = $form->$field;
            } elseif (is_callable($field)) {
                $formData[$key] = $field($form);
            } elseif (isset($form->student->$field)) {
                $formData[$field] = $form->student->$field;
            }
        }

        return $formData;
    }


    private function listFormsStudent($user, $model, $student_id)
    {
        $role = $user->current_role->role;
        $student = Student::find($student_id);
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        switch ($role) {
            case 'hod':
            case 'phd_coordinator':
                if ($student->department_id != $user->faculty->department_id) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
                break;
            case 'faculty':
                if (!$user->faculty->supervisedStudents->contains('roll_no', $student_id)) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
                break;
            case 'doctoral':
            case 'external':
                if (!$student->checkDoctoralCommittee($user->faculty->faculty_code)) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
                break;
            case 'adordc':
                if (!$user->faculty->adordcDepartments->pluck('id')->contains($student->department_id)) {
                    return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                }
                break;

            case 'student':
                return response()->json(['message' => 'You are not authorized to access this resource'], 403);
                break;
            default:
                break;
        }
        $formsQuery = $model::where('student_id', $student_id);
        $filteredForms = $formsQuery->get()->filter(function ($form) use ($role) {
            $index = array_search($role, $form->steps);
            return $index !== false && $index <= $form->maximum_step;
        });
        return  response()->json($filteredForms, 200);
    }


    private function listStudentForms($user, $model, $filters = null, $page = 1, $rows = 50, $fields = [])
    {
        $student = $user->student;
        $role = $user->current_role->role;
        $formsQuery = $model::where('student_id', $student->roll_no);

        if ($filters) {
            $formsQuery = $this->applyDynamicFilters($formsQuery, $filters);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listAdminForms($user, $model, $filters = null, $page = 1, $rows = 50, $fields = [])
    {
        $formsQuery = $model::query();

        if ($filters) {
            $formsQuery = $this->applyDynamicFilters($formsQuery, $filters);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listFacultyForms($user, $model, $filters = null, $override = false, $page = 1, $rows = 50, $fields = [])
    {
        $faculty = $user->faculty;
        $supervisedStudents = $faculty->supervisedStudents();
        $studentIds = $supervisedStudents->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $studentIds);

        if ($filters) {
            $formsQuery = $this->applyDynamicFilters($formsQuery, $filters);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listHodForms($user, $model, $filters = null, $override = false, $page = 1, $rows = 50, $fields = [])
    {
        $department = $user->faculty->department;
        $students = Student::where('department_id', $department->id)->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $students);

        if ($filters) {
            $formsQuery = $this->applyDynamicFilters($formsQuery, $filters);
        }

        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }
    private function listAdordcForms($user, $model, $filters = null, $page = 1, $rows = 50, $fields = [])
    {
        $faculty = $user->faculty;

        // Get all departments where user is ADoRDC
        $departments = $faculty->adordcDepartments->pluck('id');

        if ($departments->isEmpty()) {
            return [
                'data' => [],
                'page' => $page,
                'total' => 0,
                'totalPages' => 0,
                'fields' => $fields['fields'] ?? [],
                'fieldsTitles' => $fields['titles'] ?? [],
                'role' => $user->current_role->role,
            ];
        }

        // All students of those departments
        $studentIds = Student::whereIn('department_id', $departments)->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $studentIds);

        if ($filters) {
            $formsQuery = $this->applyDynamicFilters($formsQuery, $filters);
        }

        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listDoctoralForms($user, $model, $filters = null, $override = false, $page = 1, $rows = 50, $fields = [])
    {
        $faculty = $user->faculty;
        $doctoralStudents = $faculty->doctoredStudents();
        $studentIds = $doctoralStudents->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $studentIds);

        if ($filters) {
            $formsQuery = $this->applyDynamicFilters($formsQuery, $filters);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    public function ListStudentProfile($student)
    {
        return [
            'id' => $student->roll_no,
            'database_id' => $student->id,
            'name' => $student->user->name(),
            'first_name' => $student->user->first_name,
            'last_name' => $student->user->last_name,
            'phd_title' => $student->phd_title,
            'department_id' => $student->department_id,
            'overall_progress' => $student->overall_progress,
            'roll_no' => $student->roll_no,
            'department' => $student->department->name,
            'supervisors' => $student->supervisors->map(function ($s) {
                return [
                    'faculty_code' => $s->faculty_code,
                    'name' => $s->user->name(),
                    'email' => $s->user->email,
                    'phone' => $s->user->phone,
                    'designation' => $s->designation,
                ];
            }),
            'cgpa' => $student->cgpa,
            'email' => $student->user->email,
            'phone' => $student->user->phone,
            'current_status' => $student->current_status,
            'fathers_name' => $student->fathers_name,
            'address' => $student->address,
            'date_of_registration' => $student->date_of_registration,
            'date_of_irb' => $student->date_of_irb,
            'date_of_synopsis' => $student->date_of_synopsis,
            'doctoral' => $student->doctoralCommittee->map(function ($faculty) {
                return [
                    'faculty_code' => $faculty->faculty_code,
                    'designation' => $faculty->designation,
                    'name' => $faculty->user->name(),
                    'email' => $faculty->user->email,
                    'phone' => $faculty->user->phone,
                ];
            }),
        ];
    }
    public function ListSemesterDepartment($semesters, $dep_id)
    {
        return [
            'semester_name' => $semesters->semester_name,
            'start_date' => $semesters->start_date,
            'end_date' => $semesters->end_date,
            'year' => $semesters->year,
            'semester_off' => $semesters->studentsOnSemesterOff()
                ->where('students.department_id', $dep_id)
                ->count(),

            'leave' => $semesters->presentationsLeave()
                ->whereHas('student', function ($q) use ($dep_id) {
                    $q->where('students.department_id', $dep_id);
                })
                ->count(),

            'missed' => $semesters->presentationsMissed()
                ->whereHas('student', function ($q) use ($dep_id) {
                    $q->where('students.department_id', $dep_id);
                })
                ->count(),

            'scheduled' => $semesters->scheduledPresentations()
                ->whereHas('student', function ($q) use ($dep_id) {
                    $q->where('students.department_id', $dep_id);
                })
                ->count(),

            'unscheduled' => $semesters->unscheduledStudents()
                ->where('students.department_id', $dep_id)
                ->count(),
        ];
    }
    public function ListSemester($semesters)
    {
        return [
            'semester_name' => $semesters->semester_name,
            'start_date' => $semesters->start_date,
            'end_date' => $semesters->end_date,
            'year' => $semesters->year,
            'semester_off' => $semesters->studentsOnSemesterOff()->count(),
            'leave' => $semesters->presentationsLeave()->count(),
            'missed' => $semesters->presentationsMissed()->count(),
            'scheduled' => $semesters->scheduledPresentations()->count(),
            'unscheduled' => $semesters->unscheduledStudents()->count(),
        ];
    }
}
