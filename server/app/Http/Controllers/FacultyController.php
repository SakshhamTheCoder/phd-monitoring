<?php
namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\Department;
use App\Models\Faculty;
use App\Services\FacultyRecommendationService;
use App\Support\PersonName;
use App\Support\CsvRow;
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
            'area_of_specialization_id' => $faculty->area_of_specialization_id,
            'broad_area' => $faculty->areaOfSpecialization?->name,
        ]);
    }

    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("faculty"));
    }

    /**
     * Department ids a writer may manage faculty in, mirroring list()'s read
     * scoping: null means no limit (can_read_all_faculties), otherwise the
     * writer's own department(s), an ADORDC resolving to several via
     * adordcDepartments, everyone else to their single department.
     *
     * @return array<int, int>|null
     */
    private function facultyWriteDepartmentIds(User $user): ?array
    {
        if ($user->may('can_read_all_faculties')) {
            return null;
        }

        if (!$user->faculty) {
            return [];
        }

        $role = $user->current_role->role;

        return $role === 'adordc'
            ? $user->faculty->adordcDepartments->pluck('id')->all()
            : [$user->faculty->department_id];
    }

    public function add(Request $request)
    {

        $user = Auth::user();

        if(!$user->may('can_manage_faculties'))
        {
            return response()->json([
                'message' => 'You do not have permission to add faculty'
            ], 403);
        }

        $departmentScope = $this->facultyWriteDepartmentIds($user);

        $validationRules = [
            'full_name' => 'required_without:first_name|string',
            'first_name' => 'required_without:full_name|string',
            'last_name' => 'nullable|string',
            'email' => 'required|email|unique:users,email',
            'phone' => 'required|string|unique:users,phone',
            'department_id' => 'nullable|integer',
            'designation' => 'required|string',
            // The form no longer asks. Internal is what a new faculty member is
            // unless another caller says otherwise.
            'type' => 'nullable|in:internal,external',
            'expertise' => 'nullable',
            'area_of_specialization_id' => 'nullable|integer|exists:area_of_specializations,id',
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

        if ($departmentScope !== null) {
            $targetDepartment = $request->filled('department_id') ? Department::find($request->department_id) : null;
            if (!$targetDepartment || !in_array($targetDepartment->id, $departmentScope, true)) {
                $label = $targetDepartment->name ?? 'that department';
                return response()->json([
                    'message' => "You do not have permission to add faculty to {$label}"
                ], 403);
            }
        }

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
        $faculty->area_of_specialization_id = $request->input('area_of_specialization_id');
        $faculty->save();

        if ($password !== null) {
            $newUser->inviteToSetPassword();
        }

        return response()->json([
            'message' => $password === null
                ? 'Faculty added successfully'
                : 'Faculty added. They are emailed a link to set their password.',
            'faculty_code' => $facultyCode
        ], 200);
    }

    public function update(Request $request, $id)
    {
        $user = Auth::user();

        if(!$user->may('can_manage_faculties'))
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

        $departmentScope = $this->facultyWriteDepartmentIds($user);
        if ($departmentScope !== null && !in_array($faculty->department_id, $departmentScope, true)) {
            $label = $faculty->department?->name ?? 'that department';
            return response()->json([
                'message' => "You do not have permission to update faculty in {$label}"
            ], 403);
        }

        $validationRules = [
            'full_name' => 'nullable|string',
            'first_name' => 'nullable|string',
            'last_name' => 'nullable|string',
            'email' => 'required|email|unique:users,email,' . $faculty->user_id,
            'phone' => 'required|string|unique:users,phone,' . $faculty->user_id,
            'department_id' => 'nullable|integer',
            'designation' => 'required|string',
            // Never sending a type must not silently flip an existing faculty
            // member's type — the effective type below falls back to the
            // record's current one.
            'type' => 'nullable|in:internal,external',
            'expertise' => 'nullable',
            'area_of_specialization_id' => 'nullable|integer|exists:area_of_specializations,id',
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

        if ($departmentScope !== null && $request->filled('department_id') && (int) $request->department_id !== $faculty->department_id) {
            $destination = Department::find($request->department_id);
            if (!$destination || !in_array($destination->id, $departmentScope, true)) {
                $label = $destination->name ?? 'that department';
                return response()->json([
                    'message' => "You do not have permission to move faculty to {$label}"
                ], 403);
            }
        }

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

        // department_id is nullable in the rules but NOT NULL in the table, so a
        // caller that edits only a phone or a designation must not blank it.
        if ($request->filled('department_id')) {
            $faculty->department_id = $request->department_id;
        }
        $faculty->designation = $request->designation;
        $faculty->type = $type;
        $faculty->institution = $request->institution ?? 'Thapar Institute of Engineering and Technology';
        $faculty->website_link = $request->website_link;
        // `has`, so a field sent empty clears it. The edit form now prefills both
        // from the list row, so empty means the admin cleared it; a caller that
        // leaves the key out still keeps the stored value.
        if ($request->has('expertise')) {
            $faculty->expertise = Faculty::normalizeExpertise($request->input('expertise'));
        }
        if ($request->has('area_of_specialization_id')) {
            $faculty->area_of_specialization_id = $request->input('area_of_specialization_id') ?: null;
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
    
        // The live supervision count is an accessor that queried once per row.
        $facultyQuery = Faculty::with(['user', 'department', 'areaOfSpecialization'])
            ->withCount(['supervisedStudents as supervised_campus_count' => fn ($query) => $query->whereNull('students.date_of_thesis')]);
        
        // As in StudentController::list: the capability says whether, the role
        // says which departments, since an ADORDC answers for several.
        //
        // A viewer with only directory access reads every department: browsing
        // for a supervisor is not a departmental question. The management
        // capabilities keep their scoping.
        if ($loggedInUser->may('can_read_all_faculties')) {
            // No scoping.
        } elseif ($loggedInUser->may('can_read_department_faculties')) {
            $departments = $role === 'adordc'
                ? $loggedInUser->faculty->adordcDepartments->pluck('id')
                : [$loggedInUser->faculty->department_id];
            $facultyQuery->whereIn('department_id', $departments);
        } elseif (!$loggedInUser->may('can_read_faculty_directory')) {
            return $this->refuse();
        }
    
        if ($filters) {
            $facultyQuery = $this->applyDynamicFilters($facultyQuery, $filters, 'faculty');
        }

        // Sort alphabetically by the faculty member's name.
        $facultyQuery->orderBy(User::select('first_name')->whereColumn('users.id', 'faculty.user_id'))
            ->orderBy(User::select('last_name')->whereColumn('users.id', 'faculty.user_id'));

        $faculties = $facultyQuery->paginate($perPage, ['*'], 'page', $page);

        // Same capabilities FacultyProfileController::show gates the profile on.
        // The column is shared across every row, so unlike the profile's self
        // exception, phone can't come back for just the viewer's own row: a
        // column with one cell filled and the rest missing is worse than no
        // column, so it stays out of `fields` for anyone without the capability.
        $canSeePhone = $loggedInUser->may('can_read_faculty_phone');

        $result = $faculties->getCollection()->map(function ($faculty) use ($canSeePhone) {
            $row = [
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
                // supervised_students and doctored_students were built here with
                // two queries per row. Nothing reads them from the list (the
                // research profile has its own), doctored_students named a
                // relation Faculty does not have, and roll_number is not a field.
                'supervised_outside'=> $faculty->supervised_outside,
                'supervised_campus'=> $faculty->supervised_campus_count,
                'expertise' => $faculty->expertise ?? [],
                'area_of_specialization_id' => $faculty->area_of_specialization_id,
                'broad_area' => $faculty->areaOfSpecialization?->name,
            ];

            if (!$canSeePhone) {
                unset($row['phone']);
            }

            return $row;
        });

        $fields = ['name', 'designation', 'email', 'department'];
        $fieldsTitles = ['Name', 'Designation', 'Email', 'Department'];
        if ($canSeePhone) {
            $fields = ['name', 'designation', 'email', 'phone', 'department'];
            $fieldsTitles = ['Name', 'Designation', 'Email', 'Phone', 'Department'];
        }

        return response()->json([
            'data' => $result,
            'total' => $faculties->total(),
            'per_page' => $faculties->perPage(),
            'current_page' => $faculties->currentPage(),
            'totalPages' => $faculties->lastPage(),
            'role' => $role,
            'fields' => $fields,
            'fieldsTitles' => $fieldsTitles,
        ]);
    }
    

    /**
     * The faculty sheet's rows as it has them. The institute's supervisor sheet
     * and the portal's own template word the same columns differently, and
     * saved copies of both are in circulation, so each column is read by
     * either name.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    public static function facultyRows(array $rows): array
    {
        return array_map(fn (array $row) => [
            'full_name' => CsvRow::fallback(
                CsvRow::column($row, 'Full Name', 'full_name'),
                CsvRow::words(CsvRow::column($row, 'first_name'), CsvRow::column($row, 'last_name'))
            ),
            'email' => CsvRow::column($row, 'Email', 'email'),
            'phone' => CsvRow::column($row, 'Phone', 'phone'),
            'designation' => CsvRow::column($row, 'Designation', 'designation'),
            'faculty_code' => CsvRow::column($row, 'Emp id', 'E Code', 'faculty_code'),
            'department_code' => CsvRow::column($row, 'Department Code', 'department_code'),
            'institution' => CsvRow::column($row, 'institution'),
            'website_link' => CsvRow::column($row, 'website_link'),
            'broad_area' => CsvRow::column($row, 'Broad Area of Expertise', 'broad_area'),
            'expertise' => CsvRow::column(
                $row,
                'Specific Areas under Broad Area of Expertise (comma separated)',
                'Specific Areas under Broad Area of Expertise',
                'Specific Areas under Broad Area of Expertise (comma seperated)',
                'Area of Expertise',
                'expertise'
            ),
            'supervised_campus' => CsvRow::column($row, 'Students Supervising in TIET', 'supervised_campus'),
            'supervised_outside' => CsvRow::column($row, 'Students Supervising Outside TIET', 'Students Outside TIET', 'supervised_outside'),
            'row_number' => $row['_rowNumber'] ?? $row['row_number'] ?? null,
        ], $rows);
    }

    public function upload(Request $request)
    {
        $user = Auth::user();

        // The page posts the sheet's rows as they are; they are read here into
        // the batch the rules below check, so a row the sheet leaves without an
        // email still fails the batch the way it did.
        if ($request->has('rows')) {
            $request->merge(['batch_data' => self::facultyRows((array) $request->input('rows'))]);
        }

        if(!$user->may('can_manage_faculties'))
        {
            return response()->json([
                'message' => 'You do not have permission to upload faculty'
            ], 403);
        }

        $request->validate([
            // A sheet of 568 staff is a migration of records, not an
            // onboarding. Mailing every new one a link the moment the file is
            // uploaded sends links that expire in 24 hours, days before
            // anybody has been told the portal exists. Send sign-in links on
            // the scholars page reaches them when the office means it.
            'send_invites' => 'nullable|boolean',
            // One id for the whole run, chosen by the screen and repeated on
            // every batch, so an office's import is one group however many
            // requests it took. Send sign-in links reads it to mail exactly
            // the people one import brought in.
            'import_batch' => 'nullable|string|max:64',
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
            'batch_data.*.broad_area' => 'nullable|string',
            'batch_data.*.supervised_campus' => 'nullable',
            'batch_data.*.supervised_outside' => 'nullable',
            'batch_data.*.row_number' => 'required|integer',
        ]);

        $departmentScope = $this->facultyWriteDepartmentIds($user);

        $batch = $request->input('import_batch') ?: (string) Str::uuid();
        $importedAt = now();
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
                // Several sheets leave the phone as #N/A or blank. users.phone
                // is unique, so storing '' made the first such row take the
                // empty string and every row after it fail on a duplicate key.
                $phone = trim((string)($data['phone'] ?? ''));
                if ($phone === '' || strtoupper($phone) === '#N/A' || strtoupper($phone) === 'NA') {
                    $phone = null;
                }
                $designation = trim((string)($data['designation'] ?? ''));
                $facultyCode = isset($data['faculty_code']) && $data['faculty_code'] !== '' ? trim((string)$data['faculty_code']) : null;
                $departmentCode = isset($data['department_code']) && $data['department_code'] !== '' ? trim((string)$data['department_code']) : null;
                $institution = isset($data['institution']) && $data['institution'] !== '' ? trim((string)$data['institution']) : null;
                $websiteLink = isset($data['website_link']) && $data['website_link'] !== '' ? trim((string)$data['website_link']) : null;
                // Expertise may arrive as a JSON array (validation allows it) — only trim strings
                $expertiseRaw = $data['expertise'] ?? null;
                if (is_string($expertiseRaw)) $expertiseRaw = trim($expertiseRaw);
                $broadArea = trim((string)($data['broad_area'] ?? ''));
                $supervisedOutside = trim((string)($data['supervised_outside'] ?? ''));
                $claimedCampus = trim((string)($data['supervised_campus'] ?? ''));

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

                // A row with no department_code keeps the existing faculty's
                // department, so an update must be checked against that one.
                if ($departmentScope !== null) {
                    $rowDepartment = $department ?? $existingFacultyCheck?->department;
                    if (!$rowDepartment || !in_array($rowDepartment->id, $departmentScope, true)) {
                        $label = $rowDepartment->name ?? 'that department';
                        $errors[] = "Row " . $rowNumber . ": You do not have permission to manage faculty in {$label}";
                        $errorCount++; continue;
                    }
                }

                // The broad area has to be one this department already offers,
                // because the list is what the recommender and the faculty
                // dropdown both read. A department is needed to check it, so an
                // update with no department code uses the stored one.
                $areaId = null;
                if ($broadArea !== '') {
                    $areaDepartment = $department ?? $existingFacultyCheck?->department;
                    $areaId = $areaDepartment ? $this->areaFor($areaDepartment->id, $broadArea) : null;

                    // A wording the department's matrix does not carry is a
                    // question for the two sheets to settle, and losing the
                    // person over it is the wrong answer: they still work here.
                    // So the row lands without an area and says so.
                    if (!$areaId) {
                        $label = $areaDepartment->code ?? 'that department';
                        $errors[] = "Row " . $rowNumber . ": '{$broadArea}' is not a research area of {$label}, "
                            . "imported without one. Add it to the research area matrix or correct the spelling.";
                    }
                }

                // Two people cannot share an employee code. The sheet carries
                // a second numbering scheme for some staff, and two rows of it
                // repeat a code outright, which used to reach the database and
                // come back as a duplicate key nobody could read.
                if ($facultyCode) {
                    $heldBy = Faculty::with('user')
                        ->where('faculty_code', $facultyCode)
                        ->whereHas('user', fn ($query) => $query->whereRaw('LOWER(email) != ?', [strtolower($email)]))
                        ->first();

                    if ($heldBy) {
                        $errors[] = "Row " . $rowNumber . ": employee code {$facultyCode} already belongs to "
                            . optional($heldBy->user)->name() . " (" . optional($heldBy->user)->email . ")";
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
                        if ($phone !== null) $existingUser->phone = $phone;
                        $existingUser->save();

                        // faculty_code is an app-wide join key. An external
                        // faculty's code is auto-generated (777xxxxxx); never
                        // let a CSV row rewrite it.
                        // The sheet carries a second numbering scheme for some
                        // staff, so this is also a renumbering. The code is a
                        // join key: committees, supervisions and coordinator
                        // seats all point at it, and the database refuses to
                        // move one that is in use. Keeping the portal's number
                        // is the harmless half of that, said out loud.
                        $previousCode = $existingFaculty->faculty_code;
                        if ($facultyCode && $existingFaculty->type === 'internal') {
                            $existingFaculty->faculty_code = $facultyCode;
                        }
                        if ($department) $existingFaculty->department_id = $department->id;
                        if ($designation !== '') $existingFaculty->designation = $designation;
                        if ($institution !== null && $institution !== '') $existingFaculty->institution = $institution;
                        if ($websiteLink !== null && $websiteLink !== '') $existingFaculty->website_link = $websiteLink;
                        if ($expertiseRaw !== null && $expertiseRaw !== '') {
                            $existingFaculty->expertise = Faculty::normalizeExpertise($expertiseRaw);
                        }
                        if ($areaId) $existingFaculty->area_of_specialization_id = $areaId;
                        if ($supervisedOutside !== '') $existingFaculty->supervised_outside = (int) $supervisedOutside;
                        $existingFaculty->import_batch = $batch;
                        $existingFaculty->imported_at = $importedAt;

                        try {
                            $existingFaculty->save();
                        } catch (\Illuminate\Database\QueryException $e) {
                            if (!str_contains($e->getMessage(), 'foreign key constraint')) {
                                throw $e;
                            }

                            $existingFaculty->faculty_code = $previousCode;
                            $existingFaculty->save();
                            $errors[] = "Row " . $rowNumber . ": kept employee code {$previousCode} rather than "
                                . "{$facultyCode}, because committees or supervisions already point at it";
                        }

                        // The portal counts scholars it knows about, so the
                        // sheet's own figure is a cross check rather than
                        // something to store. A mismatch usually means a
                        // supervisor was never recorded against a scholar.
                        if ($claimedCampus !== '' && (int) $claimedCampus !== $existingFaculty->supervised_campus) {
                            $errors[] = "Row " . $rowNumber . ": sheet says {$claimedCampus} scholars in TIET, "
                                . "the portal has {$existingFaculty->supervised_campus}";
                        }

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
                            'import_batch' => $batch,
                            'imported_at' => $importedAt,
                            'area_of_specialization_id' => $areaId,
                            'supervised_outside' => $supervisedOutside !== '' ? (int) $supervisedOutside : 0,
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
                        // Nobody knows this one, so the row is mailed a link.
                        'password_set_at' => null,
                        'role_id' => $role_id,
                        'current_role_id' => $role_id,
                        'default_role_id' => $role_id,
                    ]);

                    if ($request->boolean('send_invites')) {
                        $newUser->inviteToSetPassword();
                    }

                    Faculty::create([
                        'user_id' => $newUser->id,
                        'faculty_code' => $facultyCode,
                        'department_id' => $department?->id,
                        'designation' => $designation,
                        'type' => $type,
                        'institution' => $institution,
                        'website_link' => $websiteLink,
                        'expertise' => Faculty::normalizeExpertise($expertiseRaw),
                        'import_batch' => $batch,
                        'imported_at' => $importedAt,
                        'area_of_specialization_id' => $areaId,
                        'supervised_outside' => $supervisedOutside !== '' ? (int) $supervisedOutside : 0,
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


    /**
     * The research area a faculty sheet's broad area column means.
     *
     * Two sheets describe the same thing differently. The area matrix holds one
     * cell per department, and for several departments that cell is itself a
     * list: ECED's "VLSI Design, Low power system design and test, VLSI
     * Interconnects..." is stored as one area. The faculty sheet names the
     * crisp thing a person does, "VLSI Design", and lists several of them per
     * person. Matching the two strings whole meant almost every row of the
     * faculty sheet was refused.
     *
     * So both sides are read as lists, and a person is filed under the first
     * area of their department that names something they work on. Their full
     * cell is kept in their expertise either way, so nothing is lost.
     *
     * Comparison ignores case, punctuation and "&" against "and", because
     * those differ between the two sheets on the same area.
     */
    private function areaFor(int $departmentId, string $broadArea): ?int
    {
        $normalise = fn (string $value) => trim(preg_replace(
            '/\s+/',
            ' ',
            preg_replace('/[^a-z0-9 ]/', ' ', str_replace('&', ' and ', strtolower($value)))
        ));

        $wanted = [$normalise($broadArea)];
        foreach (preg_split('/[;,]/', $broadArea) as $part) {
            $part = $normalise($part);
            if ($part !== '') {
                $wanted[] = $part;
            }
        }

        $areas = \App\Models\AreaOfSpecialization::where('department_id', $departmentId)->get(['id', 'name']);

        foreach ($wanted as $candidate) {
            foreach ($areas as $area) {
                $names = [$normalise($area->name)];
                foreach (preg_split('/[;,]/', $area->name) as $part) {
                    $part = $normalise($part);
                    if ($part !== '') {
                        $names[] = $part;
                    }
                }

                if (in_array($candidate, $names, true)) {
                    return $area->id;
                }
            }
        }

        return null;
    }
}