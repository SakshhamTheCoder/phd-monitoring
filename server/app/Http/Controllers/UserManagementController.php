<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\FilterLogicTrait;
use App\Models\User;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    use FilterLogicTrait;

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("users"));
    }

    public function list(Request $request)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $filters = $request->input('filters', []);
        $filtersJson = $request->query('filters');

        if ($filtersJson) {
            $filters = json_decode(urldecode($filtersJson), true);
        }

        $perPage = $request->input('rows', 15);
        $page = $request->input('page', 1);

        $usersQuery = User::with(['role', 'current_role', 'default_role', 'student', 'faculty']);

        if ($filters) {
            $usersQuery = $this->applyDynamicFilters($usersQuery, $filters);
        }

        $users = $usersQuery->paginate($perPage, ['*'], 'page', $page);

        $result = $users->getCollection()->map(function ($user) {
            return [
                'id' => $user->id,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'name' => $user->name(),
                'email' => $user->email,
                'phone' => $user->phone,
                'gender' => $user->gender,
                'role' => $user->role ? $user->role->role : 'N/A',
                'current_role' => $user->current_role ? $user->current_role->role : 'N/A',
                'default_role' => $user->default_role ? $user->default_role->role : 'N/A',
                'available_roles' => $user->available_roles ?? [],
                'status' => $user->status ?? 'active',
                'student_info' => $user->student ? [
                    'roll_number' => $user->student->roll_number,
                    'department' => $user->student->department->name ?? null,
                ] : null,
                'faculty_info' => $user->faculty ? [
                    'faculty_code' => $user->faculty->faculty_code,
                    'designation' => $user->faculty->designation,
                    'department' => $user->faculty->department->name ?? null,
                ] : null,
            ];
        });

        return response()->json([
            'data' => $result,
            'total' => $users->total(),
            'per_page' => $users->perPage(),
            'current_page' => $users->currentPage(),
            'totalPages' => $users->lastPage(),
            'fields' => ['name', 'email', 'phone', 'role', 'current_role', 'status'],
            'fieldsTitles' => ['Name', 'Email', 'Phone', 'Main Role', 'Current Role', 'Status'],
        ]);
    }

    public function show($id)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::with(['role', 'current_role', 'default_role', 'student', 'faculty'])->find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        return response()->json([
            'id' => $user->id,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'email' => $user->email,
            'phone' => $user->phone,
            'gender' => $user->gender,
            'role_id' => $user->role_id,
            'role' => $user->role ? $user->role->role : null,
            'current_role_id' => $user->current_role_id,
            'current_role' => $user->current_role ? $user->current_role->role : null,
            'default_role_id' => $user->default_role_id,
            'default_role' => $user->default_role ? $user->default_role->role : null,
            'available_roles' => $user->available_roles ?? [],
            'status' => $user->status ?? 'active',
            'student_info' => $user->student,
            'faculty_info' => $user->faculty,
        ]);
    }

    public function createOrUpdate(Request $request)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $isUpdate = $request->has('id') && $request->id;

        $validationRules = [
            'first_name' => 'required|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'phone' => 'required|string|max:20',
            'gender' => 'nullable|in:Male,Female',
            'role_id' => 'required|exists:roles,id',
            'current_role_id' => 'nullable|exists:roles,id',
            'default_role_id' => 'nullable|exists:roles,id',
            'available_roles' => 'nullable|array',
            // Was 'string', which let a typo or a crafted request store a role
            // name matching no roles row, an unswitchable, invisible dead role.
            'available_roles.*' => 'string|exists:roles,role',
            'status' => 'nullable|in:active,inactive,suspended',
        ];

        if ($isUpdate) {
            $validationRules['email'] = [
                'required',
                'email',
                Rule::unique('users')->ignore($request->id)
            ];
        } else {
            $validationRules['email'] = 'required|email|unique:users,email';
            $validationRules['password'] = 'nullable|string|min:8';
        }

        $request->validate($validationRules);

        if ($isUpdate) {
            $user = User::find($request->id);
            if (!$user) {
                return response()->json(['message' => 'User not found'], 404);
            }
        } else {
            $user = new User();
            // Generate password if not provided
            if (!$request->password) {
                $password = Str::password(8, true, true, true, false);
                $user->password = Hash::make($password);
            } else {
                $password = $request->password;
                $user->password = Hash::make($password);
            }
        }

        $user->first_name = $request->first_name;
        $user->last_name = $request->last_name ?? ' ';
        $user->email = $request->email;
        $user->phone = $request->phone;
        $user->gender = $request->gender;
        $user->role_id = $request->role_id;
        $user->current_role_id = $request->current_role_id ?? $request->role_id;
        $user->default_role_id = $request->default_role_id ?? $request->role_id;
        $user->available_roles = $request->available_roles;
        $user->status = $request->status ?? 'active';

        $user->save();

        // Granting a role before its linkage exists is a supported workflow (an
        // admin creates the user shell, then attaches the faculty/student record
        // or the department assignment). So this warns rather than rejects, but
        // it warns, because previously the admin got no signal at all that the
        // role they just granted would silently do nothing.
        $grantedRoles = array_filter(array_merge(
            $request->available_roles ?? [],
            [optional(\App\Models\Role::find($request->role_id))->role]
        ));
        $warnings = \App\Support\RoleRequirements::warningsFor($user->fresh(), $grantedRoles);

        return response()->json([
            'message' => $isUpdate ? 'User updated successfully' : 'User created successfully',
            'user' => $user,
            'warnings' => $warnings,
            'password' => $isUpdate ? null : ($password ?? null),
        ]);
    }

    public function delete($id)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        // Prevent deleting own account
        if ($user->id === $loggedInUser->id) {
            return response()->json(['message' => 'Cannot delete your own account'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully']);
    }

    public function resetPassword(Request $request, $id)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->password = Hash::make($request->password);
        $user->save();

        return response()->json(['message' => 'Password reset successfully']);
    }

    public function sendResetEmail($id)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $status = Password::sendResetLink(['email' => $user->email]);

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json(['message' => 'Password reset email sent successfully']);
        }

        return response()->json(['message' => 'Failed to send password reset email'], 500);
    }

    public function bulkImport(Request $request)
    {
        $loggedInUser = Auth::user();
        
        if ($loggedInUser->current_role->role !== 'admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'batch_data' => 'required|array',
            'batch_data.*.first_name' => 'nullable|string',
            'batch_data.*.last_name' => 'nullable|string',
            'batch_data.*.email' => 'required|email',
            'batch_data.*.phone' => 'nullable|string',
            'batch_data.*.gender' => 'nullable|string',
            'batch_data.*.role' => 'nullable|string',
            'batch_data.*.available_roles' => 'nullable|string',
            'batch_data.*.status' => 'nullable|string',
            'batch_data.*.row_number' => 'required|integer',
        ]);

        $batchData = $request->batch_data;
        $successCount = 0;
        $updateCount = 0;
        $errorCount = 0;
        $errors = [];

        foreach ($batchData as $data) {
            try {
                $rowNumber = $data['row_number'];
                $email = trim($data['email']);

                $existingUser = User::where('email', $email)->first();

                // Role lookup: required for new user, optional for update
                $role = null;
                if (!empty($data['role'])) {
                    $role = Role::where('role', strtolower(trim($data['role'])))->first();
                    if (!$role) {
                        $errors[] = "Row {$rowNumber}: Role '{$data['role']}' not found";
                        $errorCount++;
                        continue;
                    }
                } elseif (!$existingUser) {
                    $errors[] = "Row {$rowNumber}: Role is required for new users";
                    $errorCount++;
                    continue;
                }

                // Parse available_roles
                $availableRoles = null;
                if (isset($data['available_roles']) && $data['available_roles'] !== '') {
                    $availableRoles = array_values(array_filter(array_map('trim', explode(',', $data['available_roles']))));
                }

                if ($existingUser) {
                    // Partial update: only overwrite provided non-empty fields
                    if (!empty($data['first_name'])) $existingUser->first_name = trim($data['first_name']);
                    if (isset($data['last_name']) && $data['last_name'] !== '') $existingUser->last_name = trim($data['last_name']);
                    if (!empty($data['phone'])) $existingUser->phone = trim($data['phone']);
                    if (!empty($data['gender'])) $existingUser->gender = $data['gender'];
                    if ($role) $existingUser->role_id = $role->id;
                    if ($availableRoles !== null) $existingUser->available_roles = $availableRoles;
                    if (!empty($data['status'])) $existingUser->status = strtolower(trim($data['status']));
                    $existingUser->save();
                    $updateCount++;
                } else {
                    if (empty($data['first_name'])) {
                        $errors[] = "Row {$rowNumber}: First name required for new user";
                        $errorCount++;
                        continue;
                    }
                    $password = Str::password(8, true, true, true, false);
                    
                    User::create([
                        'first_name' => trim($data['first_name']),
                        'last_name' => isset($data['last_name']) && $data['last_name'] !== '' ? trim($data['last_name']) : ' ',
                        'email' => $email,
                        'phone' => !empty($data['phone']) ? trim($data['phone']) : '',
                        'gender' => !empty($data['gender']) ? $data['gender'] : null,
                        'password' => Hash::make($password),
                        'role_id' => $role->id,
                        'current_role_id' => $role->id,
                        'default_role_id' => $role->id,
                        'available_roles' => $availableRoles ?? [],
                        'status' => !empty($data['status']) ? strtolower(trim($data['status'])) : 'active',
                    ]);
                    $successCount++;
                }
            } catch (\Exception $e) {
                $errors[] = "Row " . $data['row_number'] . ": " . $e->getMessage();
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
            ]
        ]);
    }
}
