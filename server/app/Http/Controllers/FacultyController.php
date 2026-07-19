<?php
namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\Department;
use App\Models\Faculty;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use League\Csv\Reader;
use Maatwebsite\Excel\Facades\Excel;

class FacultyController extends Controller
{
    use FilterLogicTrait;
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("faculty"));
    }
    public function add(Request $request)
    {

        $user = Auth::user();

        if(!$user->role->can_add_faculties)
        {
            return response()->json([
                'message' => 'You do not have permission to add faculty'
            ], 403);
        }
      
        $validationRules = [
            'first_name' => 'required|string',
            'last_name' => 'nullable|string',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string',
            'department_id' => 'nullable|integer',
            'designation' => 'required|string',
            'type' => 'required|in:internal,external',
        ];

        // Only require faculty_code for internal faculty
        if ($request->type === 'internal') {
            $validationRules['faculty_code'] = 'required|string|unique:faculty,faculty_code';
        }

        // Additional fields for external faculty
        if ($request->type === 'external') {
            $validationRules['institution'] = 'required|string';
            $validationRules['website_link'] = 'nullable|url';
        }

        $request->validate($validationRules);

        // Check if user already exists
        $existingUser = User::where('email', $request->email)->first();
        
        if ($existingUser) {
            // Check if faculty already exists
            if ($existingUser->faculty) {
                return response()->json([
                    'message' => 'Faculty with this email already exists'
                ], 422);
            }
            $newUser = $existingUser;
            $password = null; // User already exists, no new password
        } else {
            $password = Str::password(8, true, true, true, false);

            $newUser = new \App\Models\User();
            $newUser->first_name = $request->first_name;
            $newUser->last_name = $request->last_name ?: ' ';
            $newUser->phone = $request->phone;
            $newUser->email = $request->email;
            $newUser->password = bcrypt($password);

            $role_id = Role::where('role','faculty')->first()->id;
            $newUser->role_id = $role_id;
            $newUser->current_role_id = $role_id;
            $newUser->default_role_id = $role_id;
            $newUser->save();
        }

        // Generate faculty code for external faculty
        if ($request->type === 'external') {
            $facultyCode = '777' . str_pad($newUser->id, 6, '0', STR_PAD_LEFT);
        } else {
            $facultyCode = $request->faculty_code;
        }

        $faculty = new \App\Models\Faculty();
        $faculty->user_id = $newUser->id;
        $faculty->department_id = $request->department_id;
        $faculty->designation = $request->designation;
        $faculty->faculty_code = $facultyCode;
        $faculty->type = $request->type;
        $faculty->institution = $request->institution ?? 'Thapar Institute of Engineering and Technology';
        $faculty->website_link = $request->website_link;
        $faculty->save();

        return response()->json([
            'message' => 'Faculty added successfully',
            'password' => $password,
            'faculty_code' => $facultyCode
        ], 200);
    }

    public function update(Request $request, $id)
    {
        $user = Auth::user();

        if(!$user->role->can_add_faculties)
        {
            return response()->json([
                'message' => 'You do not have permission to update faculty'
            ], 403);
        }

        $faculty = Faculty::where('faculty_code', $id)->first();
        if (!$faculty) {
            return response()->json([
                'message' => 'Faculty not found'
            ], 404);
        }

        $validationRules = [
            'first_name' => 'required|string',
            'last_name' => 'nullable|string',
            'email' => 'required|email|unique:users,email,' . $faculty->user_id,
            'phone' => 'required|string',
            'department_id' => 'nullable|integer',
            'designation' => 'required|string',
            'type' => 'required|in:internal,external',
        ];

        // Only validate faculty_code for internal faculty
        if ($request->type === 'internal') {
            $validationRules['faculty_code'] = 'required|string|unique:faculty,faculty_code,' . $id . ',faculty_code';
        }

        if ($request->type === 'external') {
            $validationRules['institution'] = 'required|string';
            $validationRules['website_link'] = 'nullable|url';
        }

        $request->validate($validationRules);

        // Update user
        $faculty->user->first_name = $request->first_name;
        $faculty->user->last_name = $request->last_name ?: ' ';
        $faculty->user->email = $request->email;
        $faculty->user->phone = $request->phone;
        $faculty->user->save();

        // Update faculty
        if ($request->type === 'internal') {
            $faculty->faculty_code = $request->faculty_code;
        }
        // External faculty code remains auto-generated, can't be changed

        $faculty->department_id = $request->department_id;
        $faculty->designation = $request->designation;
        $faculty->type = $request->type;
        $faculty->institution = $request->institution ?? 'Thapar Institute of Engineering and Technology';
        $faculty->website_link = $request->website_link;
        $faculty->save();

        return response()->json([
            'message' => 'Faculty updated successfully',
            'faculty_code' => $faculty->faculty_code
        ], 200);
    }

    public function list(Request $request)
    {
        $loggedInUser = Auth::user();
        $role = $loggedInUser->current_role->role;
        $filters = $request->input('filters', []);
        $filtersJson = $request->query('filters');

        if ($filtersJson) {
              $filters = json_decode(urldecode($filtersJson), true);
        }
        $perPage = $request->input('rows', 15);
        $page = $request->input('page', 1);
    
        $facultyQuery = Faculty::with(['user', 'department']);
        
        if ($role === 'hod'||$role === 'phd_coordinator') {
            $facultyQuery->where('department_id', $loggedInUser->faculty->department_id);
        }  
        else if($role==='adordc'){
             $departments = $loggedInUser->faculty->adordcDepartments->pluck('id');
             $facultyQuery->whereIn('department_id', $departments);
        }
        elseif ($role === 'admin'||$role === 'director' || $role === 'dra' || $role === 'dordc') {
          
        } else {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    
        if ($filters) {
            $facultyQuery = $this->applyDynamicFilters($facultyQuery, $filters);
        }

        // Sort alphabetically by the faculty member's name.
        $facultyQuery->orderBy(User::select('first_name')->whereColumn('users.id', 'faculty.user_id'))
            ->orderBy(User::select('last_name')->whereColumn('users.id', 'faculty.user_id'));

        $faculties = $facultyQuery->paginate($perPage, ['*'], 'page', $page);
    
        $result = $faculties->getCollection()->map(function ($faculty) {
            return [
                'id' => $faculty->faculty_code,
                'faculty_code' => $faculty->faculty_code,
                'first_name' => $faculty->user->first_name,
                'last_name' => $faculty->user->last_name,
                'name' => $faculty->user->name(),
                'designation' => $faculty->designation,
                'email' => $faculty->user->email,
                'phone' => $faculty->user->phone,
                'department' => $faculty->department?->name,
                'department_id' => $faculty->department_id,
                'type' => $faculty->type,
                'institution' => $faculty->institution,
                'website_link' => $faculty->website_link,
                'supervised_students' => $faculty->supervisedStudents?->map(fn ($s) => [
                    'name' => $s->user->name(),
                    'roll_number' => $s->roll_number,
                ]),
                'doctored_students' => $faculty->doctoralCommittee?->map(fn ($s) => [
                    'name' => $s->user->name(),
                    'roll_number' => $s->roll_number,
                ]),
                'supervised_outside'=> $faculty->supervised_outside,
                'supervised_campus'=> $faculty->supervised_campus,
            ];
        });
    
        return response()->json([
            'data' => $result,
            'total' => $faculties->total(),
            'per_page' => $faculties->perPage(),
            'current_page' => $faculties->currentPage(),
            'totalPages' => $faculties->lastPage(),
            'role' => $role,
            'fields' => ['name', 'designation', 'email', 'phone', 'department'],
            'fieldsTitles' => ['Name', 'Designation', 'Email', 'Phone', 'Department'],
        ]);
    }
    

    public function showUploadForm()
    {
        return view('upload-faculty');
    }

    public function upload(Request $request)
    {
        $user = Auth::user();

        if(!$user->role->can_add_faculties)
        {
            return response()->json([
                'message' => 'You do not have permission to upload faculty'
            ], 403);
        }

        $request->validate([
            'batch_data' => 'required|array',
            'batch_data.*.first_name' => 'required|string',
            'batch_data.*.last_name' => 'nullable|string',
            'batch_data.*.email' => 'required|email',
            'batch_data.*.phone' => 'required|string',
            'batch_data.*.designation' => 'required|string',
            'batch_data.*.type' => 'required|in:internal,external',
            'batch_data.*.faculty_code' => 'nullable|string',
            'batch_data.*.department_code' => 'nullable|string',
            'batch_data.*.institution' => 'nullable|string',
            'batch_data.*.website_link' => 'nullable|string',
            'batch_data.*.row_number' => 'required|integer',
        ]);

        $batchData = $request->batch_data;
        $successCount = 0;
        $updateCount = 0;
        $errorCount = 0;
        $errors = [];
        $createdDepartments = [];

        foreach ($batchData as $data) {
            try {
                $rowNumber = $data['row_number'];
                $firstName = trim($data['first_name']);
                $lastName = isset($data['last_name']) ? trim($data['last_name']) : '';
                $email = trim($data['email']);
                $phone = trim($data['phone']);
                $designation = trim($data['designation']);
                $type = strtolower(trim($data['type']));
                $facultyCode = isset($data['faculty_code']) ? trim($data['faculty_code']) : null;
                $departmentCode = isset($data['department_code']) ? trim($data['department_code']) : null;
                $institution = isset($data['institution']) ? trim($data['institution']) : null;
                $websiteLink = isset($data['website_link']) ? trim($data['website_link']) : null;
                
                // Validate type
                if (!in_array($type, ['internal', 'external'])) {
                    $errors[] = "Row " . $rowNumber . ": Invalid type (must be 'internal' or 'external')";
                    $errorCount++;
                    continue;
                }

                // Validate required fields based on type
                if ($type === 'internal') {
                    if (empty($facultyCode)) {
                        $errors[] = "Row " . $rowNumber . ": Faculty code required for internal faculty";
                        $errorCount++;
                        continue;
                    }
                    if (empty($departmentCode)) {
                        $errors[] = "Row " . $rowNumber . ": Department code required for internal faculty";
                        $errorCount++;
                        continue;
                    }
                    // Set default institution for internal if empty
                    if (empty($institution)) {
                        $institution = 'Thapar Institute of Engineering and Technology';
                    }
                } else {
                    // External faculty
                    if (empty($institution)) {
                        $errors[] = "Row " . $rowNumber . ": Institution required for external faculty";
                        $errorCount++;
                        continue;
                    }
                    // Faculty code will be auto-generated for external
                    $facultyCode = null;
                }

                // Validate required fields
                if (empty($firstName) || empty($email) || empty($designation)) {
                    $errors[] = "Row " . $rowNumber . ": Missing required fields (first_name, email, designation)";
                    $errorCount++;
                    continue;
                }

                // Validate email
                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $errors[] = "Row " . $rowNumber . ": Invalid email format";
                    $errorCount++;
                    continue;
                }

                // Find or create department
                $department = null;
                if ($departmentCode) {
                    $department = Department::where('code', $departmentCode)->first();
                    if (!$department) {
                        // Auto-create department for bulk upload
                        $department = Department::create([
                            'code' => $departmentCode,
                            'name' => ucfirst($departmentCode) . ' Department', // Auto-generate name from code
                        ]);
                        
                        if (!in_array($departmentCode, $createdDepartments)) {
                            $createdDepartments[] = $departmentCode;
                        }
                    }
                }

                // Check if user exists
                $existingUser = User::where('email', $email)->first();
                
                if ($existingUser) {
                    // Check if faculty already exists
                    $existingFaculty = Faculty::where('user_id', $existingUser->id)->first();
                    
                    if ($existingFaculty) {
                        // Update existing faculty
                        $existingUser->first_name = $firstName;
                        $existingUser->last_name = $lastName ?: ' ';
                        $existingUser->phone = $phone;
                        $existingUser->save();

                        if ($type === 'internal' && $facultyCode) {
                            $existingFaculty->faculty_code = $facultyCode;
                        }
                        // External faculty code remains unchanged

                        $existingFaculty->department_id = $department?->id;
                        $existingFaculty->designation = $designation;
                        $existingFaculty->type = $type;
                        $existingFaculty->institution = $institution;
                        $existingFaculty->website_link = $websiteLink;
                        $existingFaculty->save();

                        $updateCount++;
                    } else {
                        // User exists but not faculty - create faculty record
                        if ($type === 'external') {
                            $facultyCode = '777' . str_pad($existingUser->id, 6, '0', STR_PAD_LEFT);
                        }

                        Faculty::create([
                            'user_id' => $existingUser->id,
                            'faculty_code' => $facultyCode,
                            'department_id' => $department?->id,
                            'designation' => $designation,
                            'type' => $type,
                            'institution' => $institution,
                            'website_link' => $websiteLink,
                        ]);

                        $successCount++;
                    }
                } else {
                    // Create new user
                    $password = Str::password(8, true, true, true, false);
                    $role_id = Role::where('role', 'faculty')->first()->id;

                    $newUser = User::create([
                        'first_name' => $firstName,
                        'last_name' => $lastName ?: ' ',
                        'email' => $email,
                        'phone' => $phone,
                        'password' => bcrypt($password),
                        'role_id' => $role_id,
                        'current_role_id' => $role_id,
                        'default_role_id' => $role_id,
                    ]);

                    // Generate faculty code for external
                    if ($type === 'external') {
                        $facultyCode = '777' . str_pad($newUser->id, 6, '0', STR_PAD_LEFT);
                    }

                    Faculty::create([
                        'user_id' => $newUser->id,
                        'faculty_code' => $facultyCode,
                        'department_id' => $department?->id,
                        'designation' => $designation,
                        'type' => $type,
                        'institution' => $institution,
                        'website_link' => $websiteLink,
                    ]);

                    $successCount++;
                }
            } catch (\Exception $e) {
                $errors[] = "Row " . $rowNumber . ": " . $e->getMessage();
                $errorCount++;
            }
        }

        return response()->json([
            'success' => true,
            'message' => "Import completed: {$successCount} created, {$updateCount} updated, {$errorCount} errors" . 
                        (count($createdDepartments) > 0 ? ", " . count($createdDepartments) . " department(s) auto-created" : ""),
            'data' => [
                'success_count' => $successCount,
                'update_count' => $updateCount,
                'error_count' => $errorCount,
                'errors' => $errors,
                'created_departments' => $createdDepartments,
            ]
        ], 200);
    }
}