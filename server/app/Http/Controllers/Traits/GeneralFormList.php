<?php

namespace App\Http\Controllers\Traits;

// use App\Http\Traits\FilterLogicTrait;

use App\Models\Student;
use App\Http\Controllers\Traits\FilterLogicTrait;

trait GeneralFormList
{
    use FilterLogicTrait;
    use PagenationTrait;
    /**
     * The filter bar's conditions, applied to a forms list.
     *
     * A key the pages do not define is dropped, so a filter cannot name a
     * column of its own choosing. $trusted names the keys the controller built
     * itself, which the client never sent and which scope the list: the scholar
     * whose page this is, say, or the reviewer's pending forms.
     */
    private function applyFormFilters($query, $filters, array $trusted = [])
    {
        return $this->applyDynamicFilters($query, $filters, ['forms', 'presentation'], array_merge(['action', 'upcoming', 'missed'], $trusted));
    }

    private function listForms($user, $model, $request, $filters = null, $override = false, $fields = [], array $trusted = [])
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
                return $this->listStudentForms($user, $model, $filters, $page, $rows, $fields, $trusted);
            case 'hod':
            case 'phd_coordinator':
                return $this->listHodForms($user, $model, $filters, false, $page, $rows, $fields, $trusted);
            case 'dra':
            case 'dordc':
            case 'director':
            case 'admin':
                return $this->listAdminForms($user, $model, $filters, $page, $rows, $fields, $trusted);
            case 'faculty':
                return $this->listFacultyForms($user, $model, $filters, $override, $page, $rows, $fields, $trusted);
            case 'adordc':
                return $this->listAdordcForms($user, $model, $filters, $page, $rows, $fields, $trusted);
            case 'doctoral':
            case 'external':
                return $this->listDoctoralForms($user, $model, $filters, $override, $page, $rows, $fields, $trusted);
            default:
                return $this->refuse();
        }
    }




    private function paginateAndMap($formsQuery, $page, $fields, $perPage = 50, $user)
    {
        $total = $formsQuery instanceof \Illuminate\Database\Eloquent\Builder || $formsQuery instanceof \Illuminate\Database\Query\Builder
            ? $formsQuery->count()
            : count($formsQuery);
        $totalPages = ceil($total / $perPage);

        // Sort alphabetically by the student's name, matching the "Name" column
        // every form list shows. Form tables only carry student_id (a roll_no), so
        // this hops students -> users via nested correlated subqueries. Applied
        // before pagination so page 1 really is the first names alphabetically.
        if ($formsQuery instanceof \Illuminate\Database\Eloquent\Builder) {
            $formsTable = $formsQuery->getModel()->getTable();
            foreach (['first_name', 'last_name'] as $nameColumn) {
                $formsQuery->orderBy(
                    \App\Models\User::select('users.' . $nameColumn)
                        ->join('students', 'students.user_id', '=', 'users.id')
                        ->whereColumn('students.roll_no', $formsTable . '.student_id')
                        ->limit(1)
                );
            }
        }

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
                    return $this->refuse();
                }
                break;
            case 'faculty':
                if (!$user->faculty->supervisedStudents->contains('roll_no', $student_id)) {
                    return $this->refuse();
                }
                break;
            case 'doctoral':
            case 'external':
                if (!$student->checkDoctoralCommittee($user->faculty->faculty_code)) {
                    return $this->refuse();
                }
                break;
            case 'adordc':
                if (!$user->faculty->adordcDepartments->pluck('id')->contains($student->department_id)) {
                    return $this->refuse();
                }
                break;

            case 'student':
                return $this->refuse();
                break;
            default:
                break;
        }
        $formsQuery = $model::where('student_id', $student_id);
        // The step check answers "has this form reached my desk yet", which is
        // only a question for a role that appears in the chain. An admin never
        // does, so searching for them found nothing and every form was filtered
        // away: the profile's View Forms page came back empty for every scholar.
        // A role that is not a step is reading, not acting, and has already been
        // authorised above, so it sees the lot.
        $filteredForms = $formsQuery->get()->filter(function ($form) use ($role) {
            $index = array_search($role, $form->steps);
            if ($index === false) {
                return true;
            }

            return $index <= $form->maximum_step;
        });
        // The table on the other side reads {data, fields, fieldsTitles}. This
        // used to hand back a bare array, so the page drew a single S.NO column
        // and said "No results yet" however many forms came back.
        return response()->json($this->paginateAndMap($filteredForms, 1, [
            'fields' => ['status', 'stage', 'submitted'],
            'titles' => ['Status', 'Stage', 'Submitted'],
            'extra_fields' => [
                'submitted' => fn ($form) => optional($form->created_at)->format('d/m/Y'),
            ],
        ], 50, $user), 200);
    }


    private function listStudentForms($user, $model, $filters = null, $page = 1, $rows = 50, $fields = [], array $trusted = [])
    {
        $student = $user->student;
        $role = $user->current_role->role;
        $formsQuery = $model::where('student_id', $student->roll_no);

        if ($filters) {
            $formsQuery = $this->applyFormFilters($formsQuery, $filters, $trusted);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listAdminForms($user, $model, $filters = null, $page = 1, $rows = 50, $fields = [], array $trusted = [])
    {
        $formsQuery = $model::query();

        if ($filters) {
            $formsQuery = $this->applyFormFilters($formsQuery, $filters, $trusted);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listFacultyForms($user, $model, $filters = null, $override = false, $page = 1, $rows = 50, $fields = [], array $trusted = [])
    {
        $faculty = $user->faculty;
        $supervisedStudents = $faculty->supervisedStudents();
        $studentIds = $supervisedStudents->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $studentIds);

        if ($filters) {
            $formsQuery = $this->applyFormFilters($formsQuery, $filters, $trusted);
        }


        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listHodForms($user, $model, $filters = null, $override = false, $page = 1, $rows = 50, $fields = [], array $trusted = [])
    {
        $department = $user->faculty->department;
        $students = Student::where('department_id', $department->id)->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $students);

        if ($filters) {
            $formsQuery = $this->applyFormFilters($formsQuery, $filters, $trusted);
        }

        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }
    private function listAdordcForms($user, $model, $filters = null, $page = 1, $rows = 50, $fields = [], array $trusted = [])
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
            $formsQuery = $this->applyFormFilters($formsQuery, $filters, $trusted);
        }

        return $this->paginateAndMap($formsQuery, $page, $fields, $rows, $user);
    }

    private function listDoctoralForms($user, $model, $filters = null, $override = false, $page = 1, $rows = 50, $fields = [], array $trusted = [])
    {
        $faculty = $user->faculty;
        $doctoralStudents = $faculty->doctoredStudents();
        $studentIds = $doctoralStudents->pluck('roll_no');

        $formsQuery = $model::whereIn('student_id', $studentIds);

        if ($filters) {
            $formsQuery = $this->applyFormFilters($formsQuery, $filters, $trusted);
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
            'phd_title_locked' => $student->phdTitleLocked(),
            'irb_completed' => $student->irbCompleted(),
            'tentative_desc' => $student->tentative_desc,
            // The broad area is no longer typed here. It is the scholar's
            // settled area once the IRB form sets one, and their allocation
            // preferences until then, so the profile reports rather than asks.
            'broad_area' => $student->broad_area
                ?: ($student->areaPreferences->pluck('broad_area')->filter()->join(', ') ?: null),
            'can_edit_tentative' => $student->canEditTentative(),
            'is_supervisor_allocated' => $student->isSupervisorAllocated(),
            'gender' => $student->user->gender,
            'physically_handicapped' => (bool) $student->user->physically_handicapped,
            'is_jrf' => $student->is_jrf,
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
            'date_of_thesis' => $student->date_of_thesis,
            'thesis_window' => $student->thesisWindow(),
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
            'ppt_file' => $semesters->ppt_file,
            'notification' => (bool) $semesters->notification,
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
            'ppt_file' => $semesters->ppt_file,
            'notification' => (bool) $semesters->notification,
            'year' => $semesters->year,
            'semester_off' => $semesters->studentsOnSemesterOff()->count(),
            'leave' => $semesters->presentationsLeave()->count(),
            'missed' => $semesters->presentationsMissed()->count(),
            'scheduled' => $semesters->scheduledPresentations()->count(),
            'unscheduled' => $semesters->unscheduledStudents()->count(),
        ];
    }
}
