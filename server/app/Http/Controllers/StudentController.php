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
use App\Support\PersonName;

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
        if(!$loggenInUser->may('can_manage_students')){
            return response()->json([
                'message' => 'You do not have permission to create student'
            ], 403);
        }
        $role_id=Role::where('role','student')->first()->id;
        $request->validate(
            [
                'full_name' => 'required_without:first_name|string',
                'first_name' => 'required_without:full_name|string',
                'last_name' => 'nullable|string',
                'phone' => 'required|string',
                'email' => 'required|email|unique:users',
                'roll_no' => 'required|string',
                'department_id' => 'required|integer',
                'date_of_registration' => 'required|date',
                'current_status' => 'required|in:part-time,full-time,executive',
                'gender' => 'required|in:Male,Female',
                'physically_handicapped' => 'nullable|boolean',
                'date_of_irb' => 'nullable|date',
                'date_of_thesis' => 'nullable|date',
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
        $name = $request->filled('full_name')
            ? PersonName::split($request->input('full_name'))
            : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];
        $user->first_name = $name['first'];
        $user->last_name = $name['last'];
        $user->phone = $request->phone;
        $user->email = $request->email;
        $user->password = bcrypt($password);
        $user->address = $request->address;
        $user->gender = $request->gender;
        $user->physically_handicapped = $request->boolean('physically_handicapped');
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
        $student->date_of_thesis = $request->date_of_thesis;
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
        if(!$loggedInUser->may('can_manage_students')){
            return response()->json([
                'message' => 'You do not have permission to create students'
            ], 403);
        }

        $request->validate([
            'students' => 'required|array',
            'students.*.full_name' => 'nullable|string',
            'students.*.first_name' => 'nullable|string',
            'students.*.last_name' => 'nullable|string',
            'students.*.phone' => 'nullable|string',
            'students.*.email' => 'required|email',
            'students.*.roll_no' => 'nullable|string',
            'students.*.department_code' => 'nullable|string',
            'students.*.date_of_registration' => 'nullable|date',
            'students.*.current_status' => 'nullable|in:part-time,full-time,executive',
            'students.*.date_of_irb' => 'nullable|date',
            'students.*.phd_title' => 'nullable|string',
            'students.*.fathers_name' => 'nullable|string',
            'students.*.address' => 'nullable|string',
            'students.*.overall_progress' => 'nullable|numeric',
            'students.*.cgpa' => 'nullable|numeric'
        ]);

        $role_id = Role::where('role', 'student')->first()->id;
        $createCount = 0;
        $updateCount = 0;
        $failed = 0;
        $errors = [];

        DB::beginTransaction();
        
        try {
            foreach ($request->students as $index => $studentData) {
                try {
                    // Find department by code, accepting superseded codes so
                    // spreadsheets saved before the codes were corrected still
                    // import cleanly. Only validate if code was provided — partial updates may omit it.
                    $department = !empty($studentData['department_code']) ? \App\Support\DepartmentCodes::resolve($studentData['department_code']) : null;
                    if (!empty($studentData['department_code']) && !$department) {
                        $errors[] = "Row " . ($index + 1) . ": Department code '{$studentData['department_code']}' not found";
                        $failed++;
                        continue;
                    }

                    // Unified: if email or roll exists, update existing (partial) else create
                    $existingUser = \App\Models\User::where('email', $studentData['email'])->first();
                    $existingStudent = null;
                    if (!empty($studentData['roll_no'])) $existingStudent = Student::where('roll_no', $studentData['roll_no'])->first();
                    if (!$existingStudent && $existingUser) $existingStudent = Student::where('user_id', $existingUser->id)->first();

                    if ($existingUser && $existingStudent) {
                        // Partial update: only overwrite provided non-empty fields
                        // Address lives on Student only (ListStudentProfile uses student.address)
                        $name = PersonName::fromRow($studentData);
                        if ($name !== null) {
                            $existingUser->first_name = $name['first'];
                            $existingUser->last_name = $name['last'];
                        }
                        if (!empty($studentData['phone'])) $existingUser->phone = $studentData['phone'];
                        $existingUser->save();
                        if (!empty($studentData['department_code']) && $department) $existingStudent->department_id = $department->id;
                        if (array_key_exists('phd_title', $studentData)) $existingStudent->phd_title = $studentData['phd_title'];
                        if (array_key_exists('fathers_name', $studentData)) $existingStudent->fathers_name = $studentData['fathers_name'];
                        if (array_key_exists('address', $studentData)) $existingStudent->address = $studentData['address'];
                        if (array_key_exists('cgpa', $studentData)) $existingStudent->cgpa = $studentData['cgpa'];
                        if (array_key_exists('overall_progress', $studentData)) $existingStudent->overall_progress = $studentData['overall_progress'];
                        if (!empty($studentData['current_status'])) $existingStudent->current_status = $studentData['current_status'];
                        if (!empty($studentData['date_of_registration'])) $existingStudent->date_of_registration = $studentData['date_of_registration'];
                        if (array_key_exists('date_of_irb', $studentData)) $existingStudent->date_of_irb = $studentData['date_of_irb'];
                        $existingStudent->save();
                        $updateCount++;
                        continue;
                    }
                    if ($existingUser || $existingStudent) {
                        $errors[] = "Row " . ($index + 1) . ": email/roll mismatch for existing student";
                        $failed++; continue;
                    }

                    // Create new - require minimal fields
                    $name = PersonName::fromRow($studentData);
                    if ($name === null || empty($studentData['phone']) || empty($studentData['roll_no']) || empty($studentData['department_code']) || empty($studentData['date_of_registration']) || empty($studentData['current_status'])) {
                        $errors[] = "Row " . ($index + 1) . ": missing required fields for new student (full_name, phone, roll_no, department_code, date_of_registration, current_status)";
                        $failed++; continue;
                    }
                    // Generate random password
                    $password = Str::password(8, true, true, true, false);

                    // Create user (address lives on Student only)
                    $user = new \App\Models\User();
                    $user->first_name = $name['first'];
                    $user->last_name = $name['last'];
                    $user->phone = $studentData['phone'];
                    $user->email = $studentData['email'];
                    $user->password = bcrypt($password);
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

                    $createCount++;

                } catch (\Exception $e) {
                    $errors[] = "Row " . ($index + 1) . ": " . $e->getMessage();
                    $failed++;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => "Import completed: {$createCount} created, {$updateCount} updated, {$failed} errors",
                'data' => [
                    'success_count' => $createCount,
                    'update_count' => $updateCount,
                    'error_count' => $failed,
                    'errors' => $errors,
                ]
            ], 200);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Bulk upload failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    public function bulkUpdate(Request $request)
    {
        $loggedInUser = Auth::user();
        if(!$loggedInUser->may('can_manage_students')){
            return response()->json(['message' => 'You do not have permission to update students'], 403);
        }
        $request->validate([
            'students' => 'required|array',
            'students.*.email' => 'required|email',
            'students.*.roll_no' => 'nullable|string',
            'students.*.full_name' => 'nullable|string',
            'students.*.first_name' => 'nullable|string',
            'students.*.last_name' => 'nullable|string',
            'students.*.phone' => 'nullable|string',
            'students.*.department_code' => 'nullable|string',
            'students.*.date_of_registration' => 'nullable|date',
            'students.*.current_status' => 'nullable|in:part-time,full-time,executive',
            'students.*.phd_title' => 'nullable|string',
            'students.*.fathers_name' => 'nullable|string',
            'students.*.address' => 'nullable|string',
            'students.*.cgpa' => 'nullable|numeric',
            'students.*.overall_progress' => 'nullable|numeric',
        ]);
        $updated = 0; $failed = 0; $errors = [];
        DB::beginTransaction();
        try {
            foreach ($request->students as $index => $data) {
                try {
                    $user = \App\Models\User::where('email', $data['email'])->first();
                    $student = null;
                    if (!empty($data['roll_no'])) $student = Student::where('roll_no', $data['roll_no'])->first();
                    if (!$user && !$student) { $errors[] = "Row ".($index+1).": no matching student for email {$data['email']} or roll {$data['roll_no']}"; $failed++; continue; }
                    if ($user) {
                        $name = PersonName::fromRow($data);
                        if ($name !== null) {
                            $user->first_name = $name['first'];
                            $user->last_name = $name['last'];
                        }
                        if (!empty($data['phone'])) $user->phone = $data['phone'];
                        $user->save();
                    }
                    $target = $student ?? Student::where('user_id', $user->id)->first();
                    if (!$target) { $errors[] = "Row ".($index+1).": student record not found"; $failed++; continue; }
                    if (!empty($data['department_code'])) {
                        $dept = \App\Support\DepartmentCodes::resolve($data['department_code']);
                        if (!$dept) { $errors[] = "Row ".($index+1).": department code '{$data['department_code']}' not found"; $failed++; continue; }
                        $target->department_id = $dept->id;
                    }
                    if (isset($data['phd_title'])) $target->phd_title = $data['phd_title'];
                    if (isset($data['fathers_name'])) $target->fathers_name = $data['fathers_name'];
                    if (isset($data['address'])) $target->address = $data['address'];
                    if (isset($data['cgpa'])) $target->cgpa = $data['cgpa'];
                    if (isset($data['overall_progress'])) $target->overall_progress = $data['overall_progress'];
                    if (!empty($data['current_status'])) $target->current_status = $data['current_status'];
                    if (!empty($data['date_of_registration'])) $target->date_of_registration = $data['date_of_registration'];
                    if (array_key_exists('date_of_irb', $data)) $target->date_of_irb = $data['date_of_irb'];
                    $target->save();
                    $updated++;
                } catch (\Exception $e) { $errors[] = "Row ".($index+1).": ".$e->getMessage(); $failed++; }
            }
            DB::commit();
            return response()->json([
                'success' => true,
                'message' => "Import completed: 0 created, {$updated} updated, {$failed} errors",
                'data' => [
                    'success_count' => 0,
                    'update_count' => $updated,
                    'error_count' => $failed,
                    'errors' => $errors,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Bulk update failed','error' => $e->getMessage()], 500);
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

    // The capability decides whether a role may read at all; the role still
    // decides which records that means, because "their department" is one
    // department for a HOD and a list of them for an ADORDC.
    $with = ['user', 'department', 'supervisors.user', 'doctoralCommittee.user'];

    if ($loggedInUser->may('can_read_all_students')) {
        // No scoping.
    } elseif ($loggedInUser->may('can_read_department_students')) {
        $departments = $role === 'adordc'
            ? $loggedInUser->faculty->adordcDepartments->pluck('id')
            : [$loggedInUser->faculty->department_id];
        $studentsQuery->whereIn('department_id', $departments);
    } elseif ($loggedInUser->may('can_read_supervised_students')) {
        $studentsQuery = $loggedInUser->faculty->supervisedStudents()->with($with);
    } elseif ($loggedInUser->may('can_read_committee_students')) {
        $studentsQuery = $loggedInUser->faculty->doctoredStudents()->with($with);
    } elseif ($role === 'student') {
        // Reading your own record is identity, not a capability.
        $studentsQuery->where('user_id', $loggedInUser->id);
    } else {
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
        $role = $loggenInUser->current_role->role;

        // Mirrors list(): the capability decides whether, the role still decides
        // which records. These two had drifted, so a doctoral committee member
        // saw a student in the listing and was refused when they opened them.
        if ($loggenInUser->may('can_read_all_students')) {
            $student = Student::find($roll_no);
        } elseif ($loggenInUser->may('can_read_department_students')) {
            $departments = $role === 'adordc'
                ? $loggenInUser->faculty->adordcDepartments->pluck('id')
                : [$loggenInUser->faculty->department_id];
            $student = Student::whereIn('department_id', $departments)
                ->where('roll_no', $roll_no)->first();
        } elseif ($loggenInUser->may('can_read_supervised_students')
            || $loggenInUser->may('can_read_committee_students')) {
            $student = Student::find($roll_no);
            $code = $loggenInUser->faculty?->faculty_code;
            // Supervising them or sitting on their committee both count: the
            // profile links to committee students, and refusing the link the
            // page itself offers is not a boundary, it is a dead end.
            $related = $code && ($student?->checkSupervises($code) || $student?->checkDoctoralCommittee($code));
            if (!$related) {
                return response()->json([
                    'message' => 'You do not have permission to view student'
                ], 403);
            }
        } elseif ($role === 'student') {
            $student = Student::where('user_id', $loggenInUser->id)->where('roll_no', $roll_no)->first();
        } else {
            return response()->json([
                'message' => 'You do not have permission to view student'
            ], 403);
        }
        if(!$student){
            return response()->json([
                'message' => 'Student not found'
            ], 404);
        }
        return response()->json($this->profileEnvelope($student), 200);
    }

    /**
     * The signed-in student's own profile.
     *
     * Mirrors faculty: a profile is addressed either by id or by "me", and both
     * answer with the same envelope, so a page that shows a profile never has
     * to care which it asked for.
     */
    public function me()
    {
        $student = optional(Auth::user())->student;
        if (!$student) {
            return response()->json(['message' => 'No student record for this user'], 404);
        }

        return response()->json($this->profileEnvelope($student), 200);
    }

    /**
     * One profile plus what the viewer may do with it.
     *
     * The flags are named as they are on the faculty profile: `can_edit` is
     * permission to write the record at all, `can_manage` is permission to
     * write anyone's. A screen reads these instead of deciding from the role it
     * finds in local storage, which is how the student page came to offer
     * supervisor management to a doctoral member who cannot save it, and to
     * withhold it from a DRA who can.
     */
    private function profileEnvelope($student): array
    {
        return [
            'profile' => $this->ListStudentProfile($student),
            'is_self' => $this->isSelf($student),
            'can_edit' => $this->canEditProfile($student),
            'can_manage' => $this->canManageStudents(),
        ];
    }

    private function isSelf($student): bool
    {
        return optional(Auth::user())->id === $student->user_id;
    }

    private function canManageStudents(): bool
    {
        return optional(Auth::user()?->current_role)->can_manage_students === 'true';
    }

    private function canEditProfile($student): bool
    {
        if ($this->canManageStudents()) {
            return true;
        }

        return $this->isSelf($student)
            && (bool) optional(Auth::user())?->may('can_edit_own_student_profile');
    }

    // Admin/privileged update of any student, keyed by roll_no. Distinct from
    // updateProfile (which is the student editing their own limited fields).
    public function adminUpdate(Request $request, $roll_no)
    {
        if (!$this->canManageStudents()) {
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
            'full_name' => 'required_without:first_name|string',
            'first_name' => 'required_without:full_name|string',
            'last_name' => 'nullable|string',
            'phone' => 'required|string',
            'email' => 'required|email|unique:users,email,' . $user->id,
            'department_id' => 'required|integer',
            'date_of_registration' => 'required|date',
            'current_status' => 'required|in:part-time,full-time,executive',
            'gender' => 'required|in:Male,Female',
            'physically_handicapped' => 'nullable|boolean',
            'date_of_irb' => 'nullable|date',
            'date_of_thesis' => 'nullable|date',
            'phd_title' => 'nullable|string',
            'fathers_name' => 'nullable|string',
            'address' => 'nullable|string',
            'overall_progress' => 'nullable|numeric',
            'cgpa' => 'nullable|numeric',
        ]);

        $name = $request->filled('full_name')
            ? PersonName::split($request->input('full_name'))
            : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: $user->last_name];
        $user->first_name = $name['first'];
        $user->last_name = $name['last'];
        $user->phone = $request->phone;
        $user->email = $request->email;
        if ($request->has('address')) $user->address = $request->address;
        if ($request->has('gender')) $user->gender = $request->gender;
        // Extends the thesis deadline, so it stays on the privileged path only.
        if ($request->has('physically_handicapped')) $user->physically_handicapped = $request->boolean('physically_handicapped');
        $user->save();

        $student->department_id = $request->department_id;
        $student->date_of_registration = $request->date_of_registration;
        $student->date_of_irb = $request->date_of_irb;
        $student->date_of_thesis = $request->date_of_thesis;
        $student->phd_title = $request->phd_title;
        $student->fathers_name = $request->fathers_name;
        $student->current_status = $request->current_status;
        if ($request->has('address')) $student->address = $request->address;
        $student->cgpa = $request->cgpa;
        if ($request->has('overall_progress')) $student->overall_progress = $request->overall_progress;
        $student->save();

        return response()->json([
            'message' => 'Student updated successfully',
        ] + $this->profileEnvelope($student->refresh()), 200);
    }

    /**
     * The soft half of a student record: what the scholar keeps current about
     * themselves. Addressed by roll number and open to a privileged role too,
     * so it is the same shape as the faculty profile write.
     *
     * Distinct from adminUpdate, which owns the provisioning half: department,
     * admission date, status, gender. That split exists on the faculty side as
     * well, between this controller and FacultyController::update.
     */
    public function updateProfile(Request $request, $roll_no)
    {
        $student = Student::where('roll_no', $roll_no)->first();
        if (!$student) {
            return response()->json(['message' => 'Student not found'], 404);
        }

        if (!$this->canEditProfile($student)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'phone'                => 'nullable|string',
            'address'              => 'nullable|string',
            'fathers_name'         => 'nullable|string',
            'phd_title'            => 'nullable|string|max:1000',
            'tentative_desc'       => 'nullable|string|max:5000',
            'tentative_broad_area' => 'nullable|string|max:1000',
            'cgpa'                 => 'nullable|numeric',
        ]);

        // The phone belongs to the student being edited, not to whoever is
        // signed in. Reading it off the acting user would have written an
        // admin's own number onto their account.
        $user = $student->user;
        if ($user) {
            $user->phone = $request->phone ?? $user->phone;
            $user->save();
        }

        if ($request->has('address'))      $student->address      = $request->address;
        if ($request->has('fathers_name')) $student->fathers_name = $request->fathers_name;
        // PhD title and tentative fields can be edited until IRB is constituted/locked
        if (!$student->phdTitleLocked()) {
            if ($request->has('phd_title'))            $student->phd_title            = $request->phd_title;
            if ($request->has('tentative_desc'))       $student->tentative_desc       = $request->tentative_desc;
            if ($request->has('tentative_broad_area')) $student->tentative_broad_area = $request->tentative_broad_area;
        }
        if ($request->has('cgpa'))         $student->cgpa         = $request->cgpa;
        $student->save();

        return response()->json([
            'message' => 'Profile updated successfully',
        ] + $this->profileEnvelope($student->refresh()), 200);
    }
}
