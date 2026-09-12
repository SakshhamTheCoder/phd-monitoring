<?php 
namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\PhdCoordinator;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class DepartmentController extends Controller
{
    use FilterLogicTrait;
    
    public function listFilters(Request $request){
        return response()->json($this->getAvailableFilters("departments"));
    }

    public function listAreaFilters(Request $request){
        return response()->json($this->getAvailableFilters("area_of_specialization"));
    }


    public function list(Request $request)
    {
        $loggedInUser = Auth::user();
        $role = $loggedInUser->current_role->role;
        $filtersJson = $request->query('filters');
        $filters = $filtersJson ? json_decode(urldecode($filtersJson), true) : $request->input('filters', []);
    
        $perPage = $request->input('rows', 15);
        $page = $request->input('page', 1);
    
        if (!$loggedInUser->may('can_edit_department')) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }
    
        $facultyQuery = Department::with(['hod.user', 'adordc.user', 'phdCoordinators.faculty.user']);
    
        if ($filters) {
            $facultyQuery = $this->applyDynamicFilters($facultyQuery, $filters);
        }
    
        $faculties = $facultyQuery->orderBy('name')->paginate($perPage, ['*'], 'page', $page);

        $result = $faculties->getCollection()->map(function ($department) {
            return [
                'id' => $department->id,
                'name' => $department->name,
                'code' => $department->code,
                // The table renders `fields` as flat keys on the row, so the HOD
                // details are flattened here as well as kept nested below for the
                // manage-department modal.
                'hod_name' => optional(optional($department->hod)->user)->name(),
                // The official departmental address belongs to the department and
                // outlives any one HOD, so it wins when set. Falls back to the
                // person's own address for departments that have no official one.
                'hod_email' => $department->hod_email ?: optional(optional($department->hod)->user)->email,
                'hod_personal_email' => optional(optional($department->hod)->user)->email,
                'hod_phone' => optional(optional($department->hod)->user)->phone,
                'hod' => $department->hod ? [
                    'faculty_code' => $department->hod->faculty_code,
                    'designation' => $department->hod->designation,
                    'user' => [
                        'name' => optional($department->hod->user)->name(),
                        'email' => optional($department->hod->user)->email,
                        'phone' => optional($department->hod->user)->phone,
                    ],
                    'department' => [
                        'name' => $department->name
                    ]
                ] : null,
                'adordc' => $department->adordc ? [
                    'faculty_code' => $department->adordc->faculty_code,
                    'designation' => $department->adordc->designation,
                    'user' => [
                        'name' => optional($department->adordc->user)->name(),
                        'email' => optional($department->adordc->user)->email,
                        'phone' => optional($department->adordc->user)->phone,
                    ],
                    'department' => [
                        'name' => $department->name
                    ]
                ] : null,
                'phd_coordinators' => $department->phdCoordinators->map(function ($coordinator) use ($department) {

                    return [
                        'id' => $coordinator->id,
                        'faculty' => $coordinator->faculty ? [
                            'faculty_code' => $coordinator->faculty->faculty_code,
                            'designation' => $coordinator->faculty->designation,
                            'user' => [
                                'name' => optional($coordinator->faculty->user)->name(),
                                'email' => optional($coordinator->faculty->user)->email,
                                'phone' => optional($coordinator->faculty->user)->phone,
                            ],
                            'department' => [
                                'name' => $department->name
                            ]
                        ] : null
                    ];
                }),
                'students_count' => $department->students()->count(),
            ];
        });
    
        return response()->json([
            'data' => $result,
            'total' => $faculties->total(),
            'per_page' => $faculties->perPage(),
            'current_page' => $faculties->currentPage(),
            'totalPages' => $faculties->lastPage(),
            'role' => $role,
            'fields' => ['name', 'hod_name', 'hod_email', 'hod_phone'],
            'fieldsTitles' => ['Name', 'HOD Name', 'Email', 'Phone'],
        ]);
    }
    
    

    public function add(Request $request)
    {
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_add_department')){
            return response()->json([
                'message' => 'You do not have permission to create department'
            ], 403);
        }

        $request->validate(
            [
                'name' => 'required|string',
                'code' => 'required|string',
            ]
        );
        $department = new \App\Models\Department();
        $department->name = $request->name;
        $department->code = $request->code;
        $department->save();
        return response()->json([
            'message' => 'Department added successfully'
        ], 200);
    }

    public function addAreaOfSpecialization(Request $request)
    {
        try {
            $loggedInUser = Auth::user();
            if(!$loggedInUser->may('can_add_department')){
                return response()->json([
                    'message' => 'You do not have permission to add area of specialization'
                ], 403);
            }

            $request->validate($this->areaRules());

            $department = \App\Models\Department::find($request->department_id);
            if(!$department){
                return response()->json([
                    'message' => 'Department not found'
                ], 404);
            }

            $areaOfSpecialization = new \App\Models\AreaOfSpecialization();
            $areaOfSpecialization->name = $request->name;
            $areaOfSpecialization->department_id = $request->department_id;
            $areaOfSpecialization->outside_expert_id = $this->resolveOutsideExpert($request, $department);
            $areaOfSpecialization->save();

            return response()->json([
                'success' => true,
                'message' => 'Area of specialization added successfully',
                'data' => $areaOfSpecialization
            ], 200);
        } catch(\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getAreasOfSpecialization(Request $request)
    {
        try {
            $departmentId = $request->query('department_id');
            
            if (!$departmentId) {
                return response()->json([
                    'message' => 'Department ID is required'
                ], 400);
            }

            $areas = \App\Models\AreaOfSpecialization::where('department_id', $departmentId)
                ->orderBy('name')
                ->get();

            return response()->json([
                'success' => true,
                'data' => $areas
            ], 200);
        } catch(\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function listAreasOfSpecialization(Request $request)
    {
        try {
            $loggedInUser = Auth::user();
            $role = $loggedInUser->current_role->role;
            
            $filtersJson = $request->query('filters');
            $filters = $filtersJson ? json_decode(urldecode($filtersJson), true) : $request->input('filters', []);
            
            $perPage = $request->input('rows', 15);
            $page = $request->input('page', 1);

            $query = \App\Models\AreaOfSpecialization::with(['department', 'outsideExpert']);

            // Apply role-based filtering
            if ($role === 'hod') {
                $facultyCode = $loggedInUser->faculty->faculty_code;
                $hodDepartment = Department::where('hod_id', $facultyCode)->first();
                if ($hodDepartment) {
                    $query->where('department_id', $hodDepartment->id);
                }
            } elseif ($role === 'phd_coordinator') {
                $facultyCode = $loggedInUser->faculty->faculty_code;
                $coordinator = \App\Models\PhdCoordinator::where('faculty_id', $facultyCode)->first();
                if ($coordinator) {
                    $query->where('department_id', $coordinator->department_id);
                }
            }

            // Apply dynamic filters
            if ($filters) {
                $query = $this->applyDynamicFilters($query, $filters);
            }

            $areas = $query->orderBy('name')->paginate($perPage, ['*'], 'page', $page);

            $result = $areas->getCollection()->map(function ($area) {
                return [
                    'id' => $area->id,
                    'name' => $area->name,
                    'department_id' => $area->department_id,
                    'department_name' => $area->department->name ?? 'N/A',
                    'expert_id' => $area->outside_expert_id,
                    'expert_name' => $area->outsideExpert
                        ? trim($area->outsideExpert->first_name . ' ' . $area->outsideExpert->last_name)
                        : null,
                    'expert_email' => $area->outsideExpert?->email,
                    'expert_phone' => $area->outsideExpert?->phone,
                    'expert_college' => $area->outsideExpert?->institution,
                    'expert_designation' => $area->outsideExpert?->designation,
                    'expert_website' => $area->outsideExpert?->website,
                    'created_at' => $area->created_at,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result,
                'total' => $areas->total(),
                'per_page' => $areas->perPage(),
                'current_page' => $areas->currentPage(),
                'totalPages' => $areas->lastPage(),
                'role' => $role,
                'fields' => ['name', 'department_name', 'expert_name', 'expert_email', 'expert_phone'],
                'fieldsTitles' => ['Area Name', 'Department', 'Expert Name', 'Expert Email', 'Expert Phone'],
            ], 200);
        } catch(\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function updateAreaOfSpecialization(Request $request, $id)
    {
        try {
            $loggedInUser = Auth::user();
            
            $request->validate($this->areaRules());

            $area = \App\Models\AreaOfSpecialization::find($id);
            if (!$area) {
                return response()->json([
                    'message' => 'Area of specialization not found'
                ], 404);
            }

            // Check authorization
            $role = $loggedInUser->current_role->role;
            if ($role === 'hod' || $role === 'phd_coordinator') {
                $facultyCode = $loggedInUser->faculty->faculty_code;
                $allowedDepartmentId = null;
                
                if ($role === 'hod') {
                    $hodDepartment = Department::where('hod_id', $facultyCode)->first();
                    $allowedDepartmentId = $hodDepartment->id ?? null;
                } else {
                    $coordinator = \App\Models\PhdCoordinator::where('faculty_id', $facultyCode)->first();
                    $allowedDepartmentId = $coordinator->department_id ?? null;
                }

                if ($area->department_id !== $allowedDepartmentId) {
                    return response()->json([
                        'message' => 'You do not have permission to update this area'
                    ], 403);
                }
            }

            $area->name = $request->name;
            $area->department_id = $request->department_id;
            $area->outside_expert_id = $this->resolveOutsideExpert($request, $area->department);
            $area->save();

            return response()->json([
                'success' => true,
                'message' => 'Area of specialization updated successfully',
                'data' => $area
            ], 200);
        } catch(\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function deleteAreaOfSpecialization(Request $request, $id)
    {
        try {
            $loggedInUser = Auth::user();
            $area = \App\Models\AreaOfSpecialization::find($id);
            
            if (!$area) {
                return response()->json([
                    'message' => 'Area of specialization not found'
                ], 404);
            }

            // Check authorization
            $role = $loggedInUser->current_role->role;
            if ($role === 'hod' || $role === 'phd_coordinator') {
                $facultyCode = $loggedInUser->faculty->faculty_code;
                $allowedDepartmentId = null;
                
                if ($role === 'hod') {
                    $hodDepartment = Department::where('hod_id', $facultyCode)->first();
                    $allowedDepartmentId = $hodDepartment->id ?? null;
                } else {
                    $coordinator = \App\Models\PhdCoordinator::where('faculty_id', $facultyCode)->first();
                    $allowedDepartmentId = $coordinator->department_id ?? null;
                }

                if ($area->department_id !== $allowedDepartmentId) {
                    return response()->json([
                        'message' => 'You do not have permission to delete this area'
                    ], 403);
                }
            }

            // Scholars and faculty point at this row, and the preference link
            // cascades, so deleting a used area quietly drops people's choices.
            $inUse = $area->students()->exists()
                || $area->faculty()->exists()
                || \App\Models\StudentAreaPreference::where('specialization_id', $area->id)->exists();

            if ($inUse) {
                return response()->json([
                    'message' => 'This area is in use by scholars or faculty. Move them to another area before deleting it.'
                ], 409);
            }

            $area->delete();

            return response()->json([
                'success' => true,
                'message' => 'Area of specialization deleted successfully'
            ], 200);
        } catch(\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * @return array<string, string>
     */
    private function areaRules(): array
    {
        return [
            'name' => 'required|string',
            'department_id' => 'required|integer',
            'expert_name' => 'nullable|string',
            'expert_email' => 'nullable|email',
            'expert_phone' => 'nullable|string',
            'expert_college' => 'nullable|string',
            'expert_designation' => 'nullable|string',
            'expert_website' => 'nullable|string',
        ];
    }

    /**
     * The outside expert this area's form describes, as a row in the expert
     * table rather than six columns on the area.
     *
     * The same examiner covers several areas, so the email decides identity and
     * a second area naming them reuses the row instead of copying it.
     */
    private function resolveOutsideExpert(Request $request, ?\App\Models\Department $department): ?int
    {
        $email = trim((string) $request->expert_email);
        if ($email === '') {
            return null;
        }

        $name = \App\Support\PersonName::split($request->expert_name);
        $expert = \App\Models\OutsideExpert::firstOrNew(['email' => $email]);

        $expert->first_name = $name['first'] !== '' ? $name['first'] : ($expert->first_name ?: 'Unknown');
        $expert->last_name = $name['last'];
        $expert->designation = trim((string) $request->expert_designation) ?: ($expert->designation ?: 'Unknown');
        $expert->institution = trim((string) $request->expert_college) ?: ($expert->institution ?: 'Unknown');
        $expert->department = $expert->department ?: ($department->name ?? 'Unknown');
        $expert->website = $request->expert_website ?: $expert->website;

        // The phone column is unique, so a number another expert already holds
        // has to be left off rather than fail the whole save.
        $phone = trim((string) $request->expert_phone);
        if ($phone !== '' && !\App\Models\OutsideExpert::where('phone', $phone)->where('email', '!=', $email)->exists()) {
            $expert->phone = $phone;
        }

        $expert->save();

        return $expert->id;
    }

    /**
     * Load the department research areas from the institute's matrix sheet.
     *
     * The sheet is wide: one column per department code, one broad area per
     * cell below it. The page's own template is long (name, department code,
     * expert details), and saved copies of it still exist, so both are read.
     *
     * Re-running is safe. An area already on the list is left alone rather than
     * inserted again, which is what the old version did on every run. An area
     * the sheet drops is deleted only when nobody points at it; one in use is
     * kept and named in the response.
     */
    public function importAreasFromCSV(Request $request)
    {
        try {
            $loggedInUser = Auth::user();
            if (!$loggedInUser->may('can_add_department')) {
                return response()->json([
                    'message' => 'You do not have permission to import research areas'
                ], 403);
            }

            $request->validate([
                'csv_file' => 'required|file|mimes:csv,txt|max:20480',
            ]);

            $rows = array_map('str_getcsv', file($request->file('csv_file')->getRealPath()));
            $rows = array_values(array_filter($rows, fn ($row) => $row !== [null] && trim(implode('', $row)) !== ''));

            if (!$rows) {
                return response()->json(['message' => 'The file is empty'], 422);
            }

            $header = array_shift($rows);
            $areasByDepartment = $this->readAreaRows($header, $rows, $errors);

            $allowedDepartmentId = $this->areaWriteDepartmentId($loggedInUser);
            $created = 0;
            $kept = [];
            $removed = 0;

            foreach ($areasByDepartment as $departmentId => $names) {
                if ($allowedDepartmentId && $departmentId != $allowedDepartmentId) {
                    $errors[] = "Not authorized for department " . $this->departmentCode($departmentId);
                    continue;
                }

                $existing = \App\Models\AreaOfSpecialization::where('department_id', $departmentId)->get();
                $existingByKey = $existing->keyBy(fn ($area) => $this->areaKey($area->name));

                foreach ($names as $key => $name) {
                    if ($existingByKey->has($key)) {
                        continue;
                    }

                    \App\Models\AreaOfSpecialization::create([
                        'department_id' => $departmentId,
                        'name' => $name,
                    ]);
                    $created++;
                }

                foreach ($existing as $area) {
                    if (isset($names[$this->areaKey($area->name)])) {
                        continue;
                    }

                    if ($this->areaIsInUse($area)) {
                        $kept[] = $this->departmentCode($departmentId) . ': ' . $area->name;
                        continue;
                    }

                    $area->delete();
                    $removed++;
                }
            }

            return response()->json([
                'success' => true,
                'message' => "Added {$created} areas, removed {$removed} unused areas",
                'imported_count' => $created,
                'removed_count' => $removed,
                'kept_in_use' => $kept,
                'errors' => $errors,
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Read either sheet shape into department id => [key => name].
     *
     * The long template is the one with a `name` column; anything else whose
     * header carries a department code is the wide matrix. Testing for `name`
     * rather than counting codes means a department that sends a sheet for
     * itself alone still reads as wide.
     *
     * @param  array<int, string|null>  $header
     * @param  array<int, array<int, string|null>>  $rows
     * @param  array<int, string>|null  $errors
     * @return array<int, array<string, string>>
     */
    private function readAreaRows(array $header, array $rows, ?array &$errors): array
    {
        $errors = [];
        $areas = [];

        $columnDepartments = [];
        foreach ($header as $column => $code) {
            $department = \App\Support\DepartmentCodes::resolve($code);
            if ($department) {
                $columnDepartments[$column] = $department->id;
            }
        }

        $isLongTemplate = (bool) array_filter($header, fn ($column) => strtolower(trim((string) $column)) === 'name');

        if ($columnDepartments && !$isLongTemplate) {
            foreach ($rows as $row) {
                foreach ($columnDepartments as $column => $departmentId) {
                    $name = $this->cleanAreaName($row[$column] ?? null);
                    if ($name !== '') {
                        $areas[$departmentId][$this->areaKey($name)] = $name;
                    }
                }
            }

            return $areas;
        }

        // Long shape: the page's own template, one area per row.
        foreach ($rows as $index => $row) {
            $rowNumber = $index + 2;
            $rowData = $this->combineRow($header, $row);
            $name = $this->cleanAreaName($rowData['name'] ?? null);

            if ($name === '') {
                $errors[] = "Row {$rowNumber}: no area name";
                continue;
            }

            $department = \App\Support\DepartmentCodes::resolve($rowData['department_code'] ?? null)
                ?? Department::find($rowData['department_id'] ?? null);

            if (!$department) {
                $errors[] = "Row {$rowNumber}: department not found";
                continue;
            }

            $areas[$department->id][$this->areaKey($name)] = $name;
        }

        return $areas;
    }

    /**
     * Pad or trim a row to the header so a short row reports a missing value
     * rather than throwing a count mismatch that reads as "an error occurred".
     *
     * @param  array<int, string|null>  $header
     * @param  array<int, string|null>  $row
     * @return array<string, string|null>
     */
    private function combineRow(array $header, array $row): array
    {
        $row = array_pad(array_slice($row, 0, count($header)), count($header), null);

        return array_combine(array_map(fn ($key) => trim((string) $key), $header), $row);
    }

    /**
     * The one department this user may write areas for, or null for a role that
     * may write any.
     */
    private function areaWriteDepartmentId($user): ?int
    {
        $role = $user->current_role->role;

        if ($role === 'hod') {
            return Department::where('hod_id', $user->faculty->faculty_code)->value('id');
        }

        if ($role === 'phd_coordinator') {
            return \App\Models\PhdCoordinator::where('faculty_id', $user->faculty->faculty_code)
                ->value('department_id');
        }

        return null;
    }

    private function areaIsInUse(\App\Models\AreaOfSpecialization $area): bool
    {
        return $area->students()->exists()
            || $area->faculty()->exists()
            || \App\Models\StudentAreaPreference::where('specialization_id', $area->id)->exists();
    }

    private function cleanAreaName(?string $name): string
    {
        return trim(preg_replace('/\s+/', ' ', (string) $name));
    }

    /**
     * Case, spacing and punctuation differ far more often than meaning, so all
     * three are ignored when deciding whether the sheet already lists an area.
     */
    private function areaKey(?string $name): string
    {
        $normalised = strtolower(trim(preg_replace('/[^a-z0-9]+/i', ' ', (string) $name)));

        return preg_replace('/\s+/', ' ', $normalised);
    }

    private function departmentCode(int $departmentId): string
    {
        return Department::where('id', $departmentId)->value('code') ?? (string) $departmentId;
    }

    public function addHOD(Request $request)
    {
        try{
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_add_department')){
            return response()->json([
                'message' => 'You do not have permission to add HOD'
            ], 403);
        }

        $request->validate(
            [
                'department_id' => 'required|integer',
                'faculty_code' => 'required',
            ]
        );
        $department = \App\Models\Department::find($request->department_id);
        if(!$department){
            return response()->json([
                'message' => 'Department not found'
            ], 404);
        }
        $faculty = Faculty::where('faculty_code', $request->faculty_code)->first();
        if(!$faculty){
            return response()->json([
                'message' => 'Faculty not found'
            ], 404);
        }
        if($faculty->department_id != $request->department_id){
            return response()->json([
                'message' => 'Faculty does not belong to this department'
            ], 400);
        }

        // Demote the outgoing HOD, set the department linkage, then grant the
        // role, in that order and atomically. Granting the role first (as this
        // did) leaves a window where the user is an HOD of no department, and an
        // error before the department save made that state permanent.
        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $department, $faculty) {
            if($department->hod_id) {
                $oldHod = Faculty::where('faculty_code', $department->hod_id)->first();
                if($oldHod && $oldHod->user) {
                    $oldHod->user->role_id = Role::where('role', 'faculty')->first()->id;
                    $oldHod->user->current_role_id = $oldHod->user->role_id;
                    $oldHod->user->save();
                }
            }

            $department->hod_id = $request->faculty_code;
            $department->save();

            $user = $faculty->user;
            $hodRole = Role::where('role', 'hod')->first();
            $user->role_id = $hodRole->id;
            $user->current_role_id = $hodRole->id;
            $user->save();
        });

        return response()->json([
            'message' => 'HOD assigned successfully'
        ], 200);
      }
        catch(\Exception $e){
            return response()->json([
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function addAdordc(Request $request)
    {
        try{
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_add_department')){
            return response()->json([
                'message' => 'You do not have permission to assign ADORDC'
            ], 403);
        }

        $request->validate(
            [
                'department_id' => 'required|exists:departments,id',
                'faculty_code' => 'required|exists:faculty,faculty_code',
            ]
        );
        $department = \App\Models\Department::find($request->department_id);
        if(!$department){
            return response()->json([
                'message' => 'Department not found'
            ], 404);
        }
        $faculty = Faculty::where('faculty_code', $request->faculty_code)->first();
        if(!$faculty){
            return response()->json([
                'message' => 'Faculty not found'
            ], 404);
        }
     

        $adordcRole = Role::where('role', 'adordc')->first();
        if(!$adordcRole) {
            return response()->json([
                'message' => 'ADORDC role not found in system'
            ], 404);
        }

        // Demotion, linkage, then role, atomically. Same reasoning as addHOD.
        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $department, $faculty, $adordcRole) {
            // If there's an existing ADORDC, revert their role to faculty
            if($department->adordc_id) {
                $oldAdordc = Faculty::where('faculty_code', $department->adordc_id)->first();
                if($oldAdordc && $oldAdordc->user) {
                    $facultyRole = Role::where('role', 'faculty')->first();
                    $oldAdordc->user->role_id = $facultyRole->id;
                    $oldAdordc->user->current_role_id = $facultyRole->id;
                    $oldAdordc->user->save();
                }
            }

            $department->adordc_id = $request->faculty_code;
            $department->save();

            $user = $faculty->user;
            $user->role_id = $adordcRole->id;
            $user->current_role_id = $adordcRole->id;
            $user->save();
        });

        return response()->json([
            'success' => true,
            'message' => 'ADORDC assigned successfully'
        ], 200);
      }
        catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => 'An error occurred: ' . $e->getMessage()
            ], 500);
        }
    }

    public function addCoordinator(Request $request)
    {
        try{
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_add_department')){
            return response()->json([
                'message' => 'You do not have permission to add coordinator'
            ], 403);
        }

        $request->validate(
            [
                'department_id' => 'required|integer',
                'faculty_code' => 'required',
            ]
        );
        $department = \App\Models\Department::find($request->department_id);
        if(!$department){
            return response()->json([
                'message' => 'Department not found'
            ], 404);
        }
        $faculty = Faculty::where('faculty_code', $request->faculty_code)->first();
        if(!$faculty){
            return response()->json([
                'message' => 'Faculty not found'
            ], 404);
        }
        if($faculty->department_id != $request->department_id){
            return response()->json([
                'message' => 'Faculty does not belong to this department'
            ], 400);
        }

        // Check if already a coordinator
        $existing = PhdCoordinator::where('department_id', $request->department_id)
            ->where('faculty_id', $request->faculty_code)
            ->first();
        if($existing){
            return response()->json([
                'message' => 'Faculty is already a PhD Coordinator for this department'
            ], 400);
        }

        // Create the linkage before granting the role, and do both atomically.
        // Previously the role was saved first and unwrapped, so a failure here
        // left a user holding phd_coordinator with no phd_coordinators row -
        // a role that looks assigned and silently rejects every action.
        \Illuminate\Support\Facades\DB::transaction(function () use ($request, $faculty) {
            PhdCoordinator::create([
                'department_id' => $request->department_id,
                'faculty_id' => $request->faculty_code
            ]);

            $user = $faculty->user;
            $coordinatorRole = Role::where('role', 'phd_coordinator')->first();
            $user->role_id = $coordinatorRole->id;
            $user->current_role_id = $coordinatorRole->id;
            $user->save();
        });

        return response()->json([
            'message' => 'PhD Coordinator added successfully'
        ], 200);
      }
        catch(\Exception $e){
            return response()->json([
                'message' => $e->getMessage()
            ], 500);
        }
    }

    public function removeCoordinator(Request $request, $id)
    {
        try{
        $loggenInUser = Auth::user();
        if(!$loggenInUser->may('can_add_department')){
            return response()->json([
                'message' => 'You do not have permission to remove coordinator'
            ], 403);
        }

        $coordinator = PhdCoordinator::find($id);
        if(!$coordinator){
            return response()->json([
                'message' => 'PhD Coordinator not found'
            ], 404);
        }

        $faculty = Faculty::where('faculty_code', $coordinator->faculty_id)->first();
        if($faculty && $faculty->user) {
            // Revert role to faculty
            $facultyRole = Role::where('role', 'faculty')->first();
            $faculty->user->role_id = $facultyRole->id;
            $faculty->user->current_role_id = $facultyRole->id;
            $faculty->user->save();
        }

        $coordinator->delete();

        return response()->json([
            'message' => 'PhD Coordinator removed successfully'
        ], 200);
      }
        catch(\Exception $e){
            return response()->json([
                'message' => $e->getMessage()
            ], 500);
        }
    }
}