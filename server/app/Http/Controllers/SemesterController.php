<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\SaveFile;
use App\Models\Semester;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class SemesterController extends Controller
{
    use GeneralFormList, SaveFile;
    public function getRecent(Request $request, $semester_id = null)
    {
        $user = Auth::user();
        $curr_role = $user->role->role;


        if (
            $curr_role != 'dordc' &&
            $curr_role != 'hod' &&
            $curr_role != 'admin'
            && $curr_role != 'phd_coordinator'
        ) {
            if ($semester_id) {
                $semesters = Semester::where('semester_name', $semester_id)->first();
            } else
                $semesters = Semester::latest('start_date')->first();

            if (!$semesters) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'No semesters found.',
                ], 404);
            }
            return response()->json([
                'status' => 'success',
                'data' => [
                    'semester_name' => $semesters->semester_name,
                    'start_date' => $semesters->start_date,
                    'end_date' => $semesters->end_date,
                ],
            ]);
        }

        if ($semester_id) {
            $semesters = Semester::where('semester_name', $semester_id)->first();
        } else
            $semesters = Semester::latest('start_date')->first();
        if (!$semesters) {
            return response()->json([
                'status' => 'error',
                'message' => 'No semesters found.',
            ], 404);
        }
        if ($curr_role != 'hod')
            return response()->json([
                'status' => 'success',
                'data' => $this->ListSemester($semesters),
            ]);
        $dep_id = $user->faculty->department->id;

        return response()->json([
            'status' => 'success',
            'data' => $this->ListSemesterDepartment($semesters, $dep_id),
        ]);
    }

    public function create(Request $request)
    {
        $validated = $request->validate([
            'semester_name' => 'required|string|max:255',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after:start_date',
            'notification' => 'nullable|boolean',
            'ppt_file' => 'nullable|file|mimes:ppt,pptx|max:5120',
        ]);

        $user = Auth::user();
        if (
            $user->role->role != 'dordc' &&
            $user->role->role != 'admin'
        ) {
            return response()->json([
                'status' => 'error',
                'message' => 'You do not have permission to create a semester.',
            ], 403);
        }

        $semester = Semester::createOrUpdateFromCode($request->semester_name, $request->start_date, $request->end_date);

        // Handle PPT file upload
        if ($request->hasFile('ppt_file')) {
            $link = $this->replaceUploadedFile($semester->ppt_file, $request->file('ppt_file'), 'semester_ppt', $request->semester_name);
            $semester->ppt_file = $link;
            $semester->save();
        }

        return response()->json([
            'status' => 'success',
            'data' => $semester,
        ]);
    }

    public function notScheduled(Request $request, $semester_id = null)
    {
        $user = Auth::user();
        $curr_role = $user->role->role;
        if ($semester_id) {
            $semesters = Semester::where('semester_name', $semester_id)->first();
        } else {
            return response()->json([
                'status' => 'error',
                'message' => 'No semesters found.',
            ], 404);
        }
        switch ($curr_role) {
            case 'hod':
            case 'phd_coordinator':
                return $this->ListNotScheduled($request, $semesters, true);
                
            case 'faculty':
                    return $this->ListSupervisedOrDoctored($request);
            case 'dordc':
            case 'admin':
                return $this->ListNotScheduled($request, $semesters);
            default:
                return response()->json([
                    'status' => 'error',
                    'message' => 'You do not have permission to view this semester.',
                ], 403);
        }
    }
    private function ListNotScheduled($request, $semesters, $dep_id = null)
    {
        $user = Auth::user();
        $role = $user->role->role;

        // Apply pagination
        $perPage = $request->query('rows', 50); // default 10 per page
        $page = $request->query('page', 1);         // default to page 1

        $query = $semesters->unscheduledStudents();

        // Optional: Add department filter
        if ($dep_id) {
            $dep_id = $user->faculty->department->id;
            $query = $semesters->unscheduledStudents()
                ->where('students.department_id', $dep_id);
        }

        $students = $query->paginate($perPage, ['*'], 'page', $page);

        $result = $students->map(function ($student) {
            return [
                'name' => $student->user->name(),
                'designation' => $student->designation ?? '-',
                'email' => $student->user->email,
                'phone' => $student->user->phone,
                'roll_no' => $student->roll_no,
                'broad_area'=>$student->areaOfSpecialization->name ?? '-',
                'department' => $student->department->short_name ?? '-',
            ];
        });

        return response()->json([
            'data' => $result,
            'total' => $students->total(),
            'per_page' => $students->perPage(),
            'current_page' => $students->currentPage(),
            'totalPages' => $students->lastPage(),
            'role' => $role,
            'fields' => ['name', 'roll_no', 'email', 'phone', 'department', 'broad_area'],
            'fieldsTitles' => ['Name', 'Roll No', 'Email', 'Phone', 'Department', 'Broad Area of Research'  ],
        ]);
    }

    private function ListSupervisedOrDoctored($request, $type = 'supervised')
    {
        $user = Auth::user();
        $role = $user->role->role;
        $faculty = $user->faculty;
    
        // Apply pagination
        $perPage = $request->query('rows', 50);
        $page = $request->query('page', 1);
    
        // Determine which relation to use
        if ($type === 'supervised') {
            $query = $faculty->supervisedStudents();
        } elseif ($type === 'doctored') {
            $query = $faculty->doctoredStudents();
        } else {
            return response()->json(['error' => 'Invalid type specified.'], 400);
        }
    
        // Paginate the results
        $students = $query->paginate($perPage, ['*'], 'page', $page);
    
        $result = $students->map(function ($student) {
            return [
                'name' => $student->user->name(),
                'designation' => $student->designation ?? '-',
                'email' => $student->user->email,
                'phone' => $student->user->phone,
                'roll_no' => $student->roll_no,
                'broad_area'=>$student->areaOfSpecialization->name ?? '-',
                'department' => $student->department->short_name ?? '-',
            ];
        });
    
        return response()->json([
            'data' => $result,
            'total' => $students->total(),
            'per_page' => $students->perPage(),
            'current_page' => $students->currentPage(),
            'totalPages' => $students->lastPage(),
            'role' => $role,
            'type' => $type,
            'fields' => ['name', 'roll_no', 'email', 'phone', 'department', 'broad_area'],
            'fieldsTitles' => ['Name', 'Roll No', 'Email', 'Phone', 'Department', 'Broad Area of Research'],
        ]);
    }
    
}
