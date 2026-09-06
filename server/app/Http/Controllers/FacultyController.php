<?php
namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\Department;
use App\Models\Faculty;
use App\Services\FacultyRecommendationService;
use App\Support\PersonName;
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

    public function me()
    {
        $faculty = optional(Auth::user())->faculty;
        if (!$faculty) return response()->json(['message' => 'No faculty record for this user'], 404);
        $faculty->loadMissing(['user', 'department']);
        return response()->json([
            'id' => $faculty->faculty_code,
            'name' => $faculty->user->name(),
            'email' => $faculty->user->email,
            'designation' => $faculty->designation,
            'department' => $faculty->department->name ?? 'N/A',
            'expertise' => $faculty->expertise ?? [],
            'expertise_raw' => $faculty->expertise_raw,
        ]);
    }

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
            'full_name' => 'required_without:first_name|string',
            'first_name' => 'required_without:full_name|string',
            'last_name' => 'nullable|string',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string',
            'department_id' => 'nullable|integer',
            'designation' => 'required|string',
            // The form no longer asks. Internal is what a new faculty member is
            // unless another caller says otherwise.
            'type' => 'nullable|in:internal,external',
            'expertise' => 'nullable',
        ];

        $type = $request->input('type', 'internal');

        // Only require faculty_code for internal faculty
        if ($type === 'internal') {
            $validationRules['faculty_code'] = 'required|string|unique:faculty,faculty_code';
        }

        // Additional fields for external faculty
        if ($type === 'external') {
            $validationRules['institution'] = 'required|string';
            $validationRules['website_link'] = 'nullable|url';
        }

        $request->validate($validationRules);

        $name = $request->filled('full_name')
            ? PersonName::split($request->input('full_name'))
            : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];

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
            $newUser->first_name = $name['first'];
            $newUser->last_name = $name['last'];
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
        if ($type === 'external') {
            $facultyCode = '777' . str_pad($newUser->id, 6, '0', STR_PAD_LEFT);
        } else {
            $facultyCode = $request->faculty_code;
        }

        $faculty = new \App\Models\Faculty();
        $faculty->user_id = $newUser->id;
        $faculty->department_id = $request->department_id;
        $faculty->designation = $request->designation;
        $faculty->faculty_code = $facultyCode;
        $faculty->type = $type;
        $faculty->institution = $request->institution ?? 'Thapar Institute of Engineering and Technology';
        $faculty->website_link = $request->website_link;
        $faculty->expertise = Faculty::normalizeExpertise($request->input('expertise'));
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
            'full_name' => 'nullable|string',
            'first_name' => 'nullable|string',
            'last_name' => 'nullable|string',
            'email' => 'required|email|unique:users,email,' . $faculty->user_id,
            'phone' => 'required|string',
            'department_id' => 'nullable|integer',
            'designation' => 'required|string',
            // Never sending a type must not silently flip an existing faculty
            // member's type — the effective type below falls back to the
            // record's current one.
            'type' => 'nullable|in:internal,external',
            'expertise' => 'nullable',
        ];

        $type = $request->input('type', $faculty->type ?? 'internal');

        // Only validate faculty_code for internal faculty
        if ($type === 'internal') {
            $validationRules['faculty_code'] = 'required|string|unique:faculty,faculty_code,' . $id . ',faculty_code';
        }

        if ($type === 'external') {
            $validationRules['institution'] = 'required|string';
            $validationRules['website_link'] = 'nullable|url';
        }

        $request->validate($validationRules);

        // Neither full_name nor first_name is required here, so a caller that
        // only touches email/phone/department must not blank the stored name.
        if ($request->filled('full_name')) {
            $name = PersonName::split($request->input('full_name'));
        } elseif ($request->filled('first_name')) {
            $name = ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];
        } else {
            $name = ['first' => $faculty->user->first_name, 'last' => $faculty->user->last_name];
        }

        // Update user
        $faculty->user->first_name = $name['first'];
        $faculty->user->last_name = $name['last'];
        $faculty->user->email = $request->email;
        $faculty->user->phone = $request->phone;
        $faculty->user->save();

        // Update faculty
        if ($type === 'internal') {
            $faculty->faculty_code = $request->faculty_code;
        }
        // External faculty code remains auto-generated, can't be changed

        $faculty->department_id = $request->department_id;
        $faculty->designation = $request->designation;
        $faculty->type = $type;
        $faculty->institution = $request->institution ?? 'Thapar Institute of Engineering and Technology';
        $faculty->website_link = $request->website_link;
        if ($request->has('expertise')) {
            $faculty->expertise = Faculty::normalizeExpertise($request->input('expertise'));
        }
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
            'batch_data.*.full_name' => 'nullable|string',
            'batch_data.*.first_name' => 'nullable|string',
            'batch_data.*.last_name' => 'nullable|string',
            'batch_data.*.email' => 'required|email',
            'batch_data.*.phone' => 'nullable|string',
            'batch_data.*.designation' => 'nullable|string',
            'batch_data.*.faculty_code' => 'nullable|string',
            'batch_data.*.department_code' => 'nullable|string',
            'batch_data.*.institution' => 'nullable|string',
            'batch_data.*.website_link' => 'nullable|string',
            'batch_data.*.expertise' => 'nullable',
            'batch_data.*.row_number' => 'required|integer',
        ]);

        $batchData = $request->batch_data;
        $successCount = 0;
        $updateCount = 0;
        $errorCount = 0;
        $errors = [];
        // Kept so the response shape does not change for existing callers. This
        // import no longer creates departments, so it stays empty.
        $createdDepartments = [];

        foreach ($batchData as $data) {
            try {
                $rowNumber = $data['row_number'];
                $name = PersonName::fromRow($data);
                $firstName = $name['first'] ?? '';
                $lastName = $name['last'] ?? PersonName::NO_SURNAME;
                // Requirement 22: the CSV no longer carries a type. Everyone
                // imported here is internal.
                $type = 'internal';
                $email = trim((string)($data['email'] ?? ''));
                $phone = trim((string)($data['phone'] ?? ''));
                $designation = trim((string)($data['designation'] ?? ''));
                $facultyCode = isset($data['faculty_code']) && $data['faculty_code'] !== '' ? trim((string)$data['faculty_code']) : null;
                $departmentCode = isset($data['department_code']) && $data['department_code'] !== '' ? trim((string)$data['department_code']) : null;
                $institution = isset($data['institution']) && $data['institution'] !== '' ? trim((string)$data['institution']) : null;
                $websiteLink = isset($data['website_link']) && $data['website_link'] !== '' ? trim((string)$data['website_link']) : null;
                // Expertise may arrive as a JSON array (validation allows it) — only trim strings
                $expertiseRaw = $data['expertise'] ?? null;
                if (is_string($expertiseRaw)) $expertiseRaw = trim($expertiseRaw);

                // Determine if this is an update (existing faculty by email)
                $existingUserCheck = User::where('email', $email)->first();
                $existingFacultyCheck = $existingUserCheck ? Faculty::where('user_id', $existingUserCheck->id)->first() : null;
                $isUpdate = $existingFacultyCheck !== null;

                // For updates, only email is required — other fields are optional and only updated if provided
                // For creates, enforce full validation
                if (!$isUpdate) {
                    if (empty($facultyCode)) { $errors[] = "Row " . $rowNumber . ": Faculty code required for internal faculty"; $errorCount++; continue; }
                    if (empty($departmentCode)) { $errors[] = "Row " . $rowNumber . ": Department code required for internal faculty"; $errorCount++; continue; }
                    if (empty($institution)) $institution = 'Thapar Institute of Engineering and Technology';
                    if ($firstName === '') {
                        $errors[] = "Row " . $rowNumber . ": full_name is required for a new faculty member";
                        $errorCount++;
                        continue;
                    }
                    if (empty($email) || empty($designation)) {
                        $errors[] = "Row " . $rowNumber . ": Missing required fields (email, designation) for new faculty";
                        $errorCount++; continue;
                    }
                } else {
                    if ($facultyCode === '') $facultyCode = null;
                }

                if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    $errors[] = "Row " . $rowNumber . ": Invalid email format"; $errorCount++; continue;
                }

                $department = null;
                if ($departmentCode) {
                    $department = \App\Support\DepartmentCodes::resolve($departmentCode);
                    if (!$department) {
                        $errors[] = "Row " . $rowNumber . ": Department code '{$departmentCode}' not found. "
                            . "Create the department first, or correct the code.";
                        $errorCount++; continue;
                    }
                }

                // Check if user exists
                $existingUser = User::where('email', $email)->first();
                
                if ($existingUser) {
                    $existingFaculty = Faculty::where('user_id', $existingUser->id)->first();
                    
                    if ($existingFaculty) {
                        // Partial update: only overwrite provided non-empty fields.
                        // $name is null when the row carries no name at all, which
                        // must leave the stored name untouched rather than blanking it.
                        if ($name !== null) {
                            $existingUser->first_name = $name['first'];
                            $existingUser->last_name = $name['last'];
                        }
                        if ($phone !== '') $existingUser->phone = $phone;
                        $existingUser->save();

                        if ($facultyCode) {
                            $existingFaculty->faculty_code = $facultyCode;
                        }
                        if ($department) $existingFaculty->department_id = $department->id;
                        if ($designation !== '') $existingFaculty->designation = $designation;
                        if ($institution !== null && $institution !== '') $existingFaculty->institution = $institution;
                        if ($websiteLink !== null && $websiteLink !== '') $existingFaculty->website_link = $websiteLink;
                        if ($expertiseRaw !== null && $expertiseRaw !== '') {
                            $existingFaculty->expertise = Faculty::normalizeExpertise($expertiseRaw);
                        }
                        $existingFaculty->save();

                        $updateCount++;
                    } else {
                        // User exists but not faculty - create faculty record (always internal)
                        Faculty::create([
                            'user_id' => $existingUser->id,
                            'faculty_code' => $facultyCode,
                            'department_id' => $department?->id,
                            'designation' => $designation,
                            'type' => $type,
                            'institution' => $institution,
                            'website_link' => $websiteLink,
                            'expertise' => Faculty::normalizeExpertise($expertiseRaw),
                        ]);

                        $successCount++;
                    }
                } else {
                    // Create new user
                    $password = Str::password(8, true, true, true, false);
                    $role_id = Role::where('role', 'faculty')->first()->id;

                    $newUser = User::create([
                        'first_name' => $firstName,
                        'last_name' => $lastName,
                        'email' => $email,
                        'phone' => $phone,
                        'password' => bcrypt($password),
                        'role_id' => $role_id,
                        'current_role_id' => $role_id,
                        'default_role_id' => $role_id,
                    ]);

                    Faculty::create([
                        'user_id' => $newUser->id,
                        'faculty_code' => $facultyCode,
                        'department_id' => $department?->id,
                        'designation' => $designation,
                        'type' => $type,
                        'institution' => $institution,
                        'website_link' => $websiteLink,
                        'expertise' => Faculty::normalizeExpertise($expertiseRaw),
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
            'message' => "Import completed: {$successCount} created, {$updateCount} updated, {$errorCount} errors",
            'data' => [
                'success_count' => $successCount,
                'update_count' => $updateCount,
                'error_count' => $errorCount,
                'errors' => $errors,
                'created_departments' => $createdDepartments,
            ]
        ], 200);
    }

    public function recommend(Request $request)
    {
        $request->validate([
            'areas' => 'required|array|min:1',
            'areas.*' => 'string',
            'department_id' => 'nullable|integer|exists:departments,id',
            'limit' => 'nullable|integer|min:1|max:20',
        ]);
        $service = app(FacultyRecommendationService::class);
        $result = $service->recommend(
            $request->input('areas'),
            $request->input('department_id'),
            (int) $request->input('limit', 8)
        );
        return response()->json(['data' => $result], 200);
    }

}