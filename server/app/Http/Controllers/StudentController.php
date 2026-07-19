<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Http\Controllers\Traits\GeneralFormList;
use App\Http\Controllers\Traits\PagenationTrait;
use App\Models\Forms;
use Illuminate\Http\Request;    
use Illuminate\Support\Facades\Auth;
use App\Models\Role;
use App\Models\Student;
use App\Models\Department;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StudentController extends Controller {
    use FilterLogicTrait;
    use PagenationTrait;
    use GeneralFormList;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("student"));
    }
    public function add(Request $request)
    {
        $loggenInUser = Auth::user();
        if($loggenInUser->current_role->can_add_student == 'false'){
            return response()->json([
                'message' => 'You do not have permission to create student'
            ], 403);
        }
        $role_id=Role::where('role','student')->first()->id;
        $request->validate(
            [
                'first_name' => 'required|string',
                'last_name' => 'nullable|string',
                'phone' => 'required|string',
                'email' => 'required|email|unique:users',
                'roll_no' => 'required|string',
                'department_id' => 'required|integer',
                'date_of_registration' => 'required|date',
                'current_status' => 'required|in:part-time,full-time,executive',
                'gender' => 'required|in:Male,Female',
                'date_of_irb' => 'nullable|date',
                'phd_title' => 'nullable|string',
                'fathers_name' => 'nullable|string',
                'address' => 'nullable|string',
                'overall_progress' => 'nullable|numeric',
                'cgpa' => 'nullable|numeric'
            ]
        );
        $password = Str::password(8, true, true, true, false);
        //generated a random password for the new user he will change it later

        $user = new \App\Models\User();
        $user->first_name = $request->first_name;
        $user->last_name = $request->last_name ?? ' ';
        $user->phone = $request->phone;
        $user->email = $request->email;
        $user->password = bcrypt($password);
        $user->address = $request->address;
        $user->gender = $request->gender;
        $user->role_id = $role_id;
        //crate new entry in users table


        $role_id = Role::where('role','student')->first()->id;
        $user->current_role_id = $role_id;
        $user->save();
        //fetch role id of student and save it in user table

        $student = new \App\Models\Student();
        $student->user_id = $user->id;
        $student->roll_no = $request->roll_no;
        $student->department_id = $request->department_id;
        $student->date_of_registration = $request->date_of_registration;
        $student->date_of_irb = $request->date_of_irb;
        $student->phd_title = $request->phd_title;
        $student->fathers_name = $request->fathers_name;
        $student->current_status = $request->current_status;
        $student->address = $request->address;
        $student->cgpa = $request->cgpa;
        if($request->has('overall_progress'))
             $student->overall_progress = $request->overall_progress;
        else
             $student->overall_progress = 0;
        
     

        $student->save();
        //create new entry in students table
        $adminFormController = new \App\Http\Controllers\AdminFormController();
        $formData = $adminFormController->getFormCreationData(
            'supervisor-allocation',
            $student->roll_no,
            $student->department_id
        );
        
        if ($formData) {
            Forms::create($formData);
        }
        return response()->json($password,200);
        //return the password to the user
        //TODO: Send email to the user with the password        
    }

    public function bulkUpload(Request $request)
    {
        $loggedInUser = Auth::user();
        if($loggedInUser->current_role->can_add_student == 'false'){
            return response()->json([
                'message' => 'You do not have permission to create students'
            ], 403);
        }

        $request->validate([
            'students' => 'required|array',
            'students.*.first_name' => 'required|string',
            'students.*.last_name' => 'nullable|string',
            'students.*.phone' => 'required|string',
            'students.*.email' => 'required|email',
            'students.*.roll_no' => 'required|string',
            'students.*.department_code' => 'required|string',
            'students.*.date_of_registration' => 'required|date',
            'students.*.current_status' => 'required|in:part-time,full-time,executive',
            'students.*.date_of_irb' => 'nullable|date',
            'students.*.phd_title' => 'nullable|string',
            'students.*.fathers_name' => 'nullable|string',
            'students.*.address' => 'nullable|string',
            'students.*.overall_progress' => 'nullable|numeric',
            'students.*.cgpa' => 'nullable|numeric'
        ]);

        $role_id = Role::where('role', 'student')->first()->id;
        $successful = 0;
        $failed = 0;
        $errors = [];

        DB::beginTransaction();
        
        try {
            foreach ($request->students as $index => $studentData) {
                try {
                    // Find department by code, accepting superseded codes so
                    // spreadsheets saved before the codes were corrected still
                    // import cleanly.
                    $department = \App\Support\DepartmentCodes::resolve($studentData['department_code']);

                    if (!$department) {
                        $errors[] = "Row " . ($index + 1) . ": Department code '{$studentData['department_code']}' not found";
                        $failed++;
                        continue;
                    }

                    // Check if email already exists
                    $existingUser = \App\Models\User::where('email', $studentData['email'])->first();
                    if ($existingUser) {
                        $errors[] = "Row " . ($index + 1) . ": Email '{$studentData['email']}' already exists";
                        $failed++;
                        continue;
                    }

                    // Check if roll number already exists
                    $existingStudent = Student::where('roll_no', $studentData['roll_no'])->first();
                    if ($existingStudent) {
                        $errors[] = "Row " . ($index + 1) . ": Roll number '{$studentData['roll_no']}' already exists";
                        $failed++;
                        continue;
                    }

                    // Generate random password
                    $password = Str::password(8, true, true, true, false);

                    // Create user
                    $user = new \App\Models\User();
                    $user->first_name = $studentData['first_name'];
                    $user->last_name = $studentData['last_name'] ?? ' ';
                    $user->phone = $studentData['phone'];
                    $user->email = $studentData['email'];
                    $user->password = bcrypt($password);
                    $user->address = $studentData['address'] ?? null;
                    $user->role_id = $role_id;
                    $user->current_role_id = $role_id;
                    $user->save();

                    // Create student
                    $student = new Student();
                    $student->user_id = $user->id;
                    $student->roll_no = $studentData['roll_no'];
                    $student->department_id = $department->id;
                    $student->date_of_registration = $studentData['date_of_registration'];
                    $student->date_of_irb = $studentData['date_of_irb'] ?? null;
                    $student->phd_title = $studentData['phd_title'] ?? null;
                    $student->fathers_name = $studentData['fathers_name'] ?? null;
                    $student->current_status = $studentData['current_status'];
                    $student->address = $studentData['address'] ?? null;
                    $student->cgpa = $studentData['cgpa'] ?? null;
                    $student->overall_progress = $studentData['overall_progress'] ?? 0.0;
                    $student->save();

                    // Create supervisor allocation form
                    $adminFormController = new \App\Http\Controllers\AdminFormController();
                    $formData = $adminFormController->getFormCreationData(
                        'supervisor-allocation',
                        $student->roll_no,
                        $student->department_id
                    );
                    
                    if ($formData) {
                        Forms::create($formData);
                    }

                    $successful++;

                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 1) . ": " . $e->getMessage();
                    $failed++;
                }
            }

            DB::commit();

            return response()->json([
                'successful' => $successful,
                'failed' => $failed,
                'errors' => $errors
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Bulk upload failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

 public function list(Request $request)
{
    $loggedInUser = Auth::user();
    $role = $loggedInUser->current_role->role;
    $filters = $request->input('filters', []);
    $perPage = $request->input('rows', 15);
    $page = $request->input('page', 1);
    $all = $request->input('all', false);
    $filtersJson = $request->query('filters');

    if ($filtersJson) {
          $filters = json_decode(urldecode($filtersJson), true);
    }

    $studentsQuery = Student::with(['user', 'department', 'supervisors.user', 'doctoralCommittee.user']);

    switch ($role) {
        case 'hod':
        case 'phd_coordinator':
            $studentsQuery->where('department_id', $loggedInUser->faculty->department_id);
            break;
        case 'faculty':
            $studentsQuery = $loggedInUser->faculty->supervisedStudents()->with(['user', 'department', 'supervisors.user', 'doctoralCommittee.user']);
            break;
        case 'doctoral':
        case 'external':
            $studentsQuery = $loggedInUser->faculty->doctoredStudents()->with(['user', 'department', 'supervisors.user', 'doctoralCommittee.user']);
            break;
        case 'student':
            $studentsQuery->where('user_id', $loggedInUser->id);
            break;
        case 'adordc': 
            $departments = $loggedInUser->faculty->adordcDepartments->pluck('id');
            $studentsQuery->whereIn('department_id', $departments);
            break;
        case 'admin':
        case 'director':
        case 'dra':
        case 'dordc':
            break;
        default:
            return response()->json(['message' => 'You do not have permission to view students'], 403);
    }

    if ($filters) {
        $studentsQuery = $this->applyDynamicFilters($studentsQuery, $filters);
    }

    // Sort alphabetically by the student's name. Ordered via a correlated subquery
    // rather than a join so the eager loads and `select *` above stay intact.
    $studentsQuery->orderBy(User::select('first_name')->whereColumn('users.id', 'students.user_id'))
        ->orderBy(User::select('last_name')->whereColumn('users.id', 'students.user_id'));

    // Check if all flag is set
    if ($all) {
        $students = $studentsQuery->get();
        $result = $students->map(function ($student) {
            return $this->ListStudentProfile($student);
        });
        
        return response()->json([
            'data' => $result,
            'total' => $students->count(),
            'per_page' => $students->count(),
            'current_page' => 1,
            'totalPages' => 1,
            'role' => $role,
            'fields'=>['name','roll_no','overall_progress','department','email','phone'],
            'fieldsTitles'=>['Name','Roll No','Overall Progress','Department','Email','Phone'],
        ]);
    }
    
    $students = $studentsQuery->paginate($perPage, ['*'], 'page', $page);
    $result = $students->getCollection()->map(function ($student) {
        return $this->ListStudentProfile($student);
    });

    return response()->json([
        'data' => $result,
        'total' => $students->total(),
        'per_page' => $students->perPage(),
        'current_page' => $students->currentPage(),
        'totalPages' => $students->lastPage(),
        'role' => $role,
         'fields'=>['name','roll_no','overall_progress','department','email','phone'],
         'fieldsTitles'=>['Name','Roll No','Overall Progress','Department','Email','Phone'],
    ]);
}

    
    

    public function get(Request $request, $roll_no)
    {
        $loggenInUser = Auth::user();
        $role=$loggenInUser->current_role->role;
        switch($role){
            case 'admin':
            case 'director':
            case 'dra':
            case 'dordc':
                $student = Student::find($roll_no);
                break;
            case 'adordc': 
                 $departments = $loggenInUser->faculty->adordcDepartments->pluck('id');
                $student = Student::whereIn('department_id', $departments)
                    ->where('roll_no', $roll_no)->first();
            break;
            case 'hod':
            case 'phd_coordinator':
                $student = Student::where('department_id',$loggenInUser->faculty->department_id)->where('roll_no',$roll_no)->first();
                break;
            case 'faculty':
                $student =  Student::find($roll_no);
                if(!$student->checkSupervises($loggenInUser->faculty->faculty_code))
                    return response()->json([
                        'message' => 'You do not have permission to view student'
                    ], 403);
               break;
            case 'student':
                $student = Student::where('user_id',$loggenInUser->id)->where('roll_no',$roll_no)->first();
                break;
            default:
                return response()->json([
                    'message' => 'You do not have permission to view student'
                ], 403);
        }
        if(!$student){
            return response()->json([
                'message' => 'Student not found'
            ], 404);
        }
        $stu= $this->ListStudentProfile($student);
        return response()->json([
            'data'=>[$stu]
        ],200);
    }

    // Admin/privileged update of any student, keyed by roll_no. Distinct from
    // updateProfile (which is the student editing their own limited fields).
    public function adminUpdate(Request $request, $roll_no)
    {
        $loggedInUser = Auth::user();
        if ($loggedInUser->current_role->can_add_student == 'false') {
            return response()->json([
                'message' => 'You do not have permission to edit student'
            ], 403);
        }

        $student = Student::where('roll_no', $roll_no)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }
        $user = $student->user;

        $request->validate([
            'first_name' => 'required|string',
            'last_name' => 'nullable|string',
            'phone' => 'required|string',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'department_id' => 'required|integer',
            'date_of_registration' => 'required|date',
            'current_status' => 'required|in:part-time,full-time,executive',
            'gender' => 'required|in:Male,Female',
            'date_of_irb' => 'nullable|date',
            'phd_title' => 'nullable|string',
            'fathers_name' => 'nullable|string',
            'address' => 'nullable|string',
            'overall_progress' => 'nullable|numeric',
            'cgpa' => 'nullable|numeric',
        ]);

        $user->first_name = $request->first_name;
        $user->last_name = $request->last_name ?? $user->last_name;
        $user->phone = $request->phone;
        $user->email = $request->email;
        if ($request->has('address')) $user->address = $request->address;
        if ($request->has('gender')) $user->gender = $request->gender;
        $user->save();

        $student->department_id = $request->department_id;
        $student->date_of_registration = $request->date_of_registration;
        $student->date_of_irb = $request->date_of_irb;
        $student->phd_title = $request->phd_title;
        $student->fathers_name = $request->fathers_name;
        $student->current_status = $request->current_status;
        if ($request->has('address')) $student->address = $request->address;
        $student->cgpa = $request->cgpa;
        if ($request->has('overall_progress')) $student->overall_progress = $request->overall_progress;
        $student->save();

        return response()->json(['message' => 'Student updated successfully'], 200);
    }

    public function updateProfile(Request $request)
    {
        $user = Auth::user();
        if ($user->current_role->role !== 'student') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'phone'       => 'nullable|string',
            'address'     => 'nullable|string',
            'fathers_name'=> 'nullable|string',
            'phd_title'   => 'nullable|string',
            'cgpa'        => 'nullable|numeric',
        ]);

        $user->phone = $request->phone ?? $user->phone;
        $user->save();

        $student = $user->student;
        if ($student) {
            if ($request->has('address'))      $student->address      = $request->address;
            if ($request->has('fathers_name')) $student->fathers_name = $request->fathers_name;
            // The PhD title can only be edited from the profile until the IRB
            // constitution form is submitted; after that it is owned by that form.
            if ($request->has('phd_title') && !$student->phdTitleLocked()) {
                $student->phd_title = $request->phd_title;
            }
            if ($request->has('cgpa'))         $student->cgpa         = $request->cgpa;
            $student->save();
        }

        return response()->json(['message' => 'Profile updated successfully'], 200);
    }
}
