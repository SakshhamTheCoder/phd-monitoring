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
use App\Support\PersonName;

class UserManagementController extends Controller
{

    /**
     * Accounts nobody has claimed yet.
     *
     * An import creates accounts without mailing anybody, so these are the
     * people who cannot sign in. Two marks, because there are two ways in:
     * password_set_at stays null until somebody completes a reset, and
     * email_verified_at is stamped the first time they sign in with Google,
     * which is a way in that never sets a password.
     *
     * $batch narrows it to the people one import run brought in, scholars or
     * staff. Without it the answer is every unclaimed account, which is the
     * clerks a departments import created as much as anybody else.
     */
    private function whoCannotSignIn(?string $batch = null)
    {
        $users = User::whereNull('password_set_at')
            ->whereNull('email_verified_at')
            ->orderBy('id');

        if ($batch !== null) {
            $users->where(function ($query) use ($batch) {
                $query->whereIn('id', \App\Models\Student::query()->select('user_id')->where('import_batch', $batch))
                    ->orWhereIn('id', \App\Models\Faculty::query()->select('user_id')->where('import_batch', $batch));
            });
        }

        return $users;
    }

    /**
     * Every import run that still has somebody waiting for a link.
     *
     * Newest first, because that is the one the office has just done. An
     * earlier run stays on this list until its last person has signed in, so
     * a second import never buries the first.
     */
    private function importRuns()
    {
        $runs = collect();

        foreach ([[\App\Models\Student::class, 'scholars'], [\App\Models\Faculty::class, 'staff']] as [$model, $of]) {
            $model::query()
                ->whereNotNull('import_batch')
                ->selectRaw('import_batch, MAX(imported_at) as imported_at')
                ->groupBy('import_batch')
                ->orderByDesc('imported_at')
                ->get()
                ->each(function ($row) use ($runs, $of) {
                    $waiting = $this->whoCannotSignIn($row->import_batch)->count();
                    if ($waiting > 0) {
                        $runs->push([
                            'batch' => $row->import_batch,
                            'of' => $of,
                            'imported_at' => $row->imported_at,
                            'waiting' => $waiting,
                        ]);
                    }
                });
        }

        return $runs->sortByDesc('imported_at')->values();
    }

    public function pendingSignInLinks()
    {
        if (!Auth::user()->may('can_manage_users')) {
            return response()->json(['message' => 'You do not have permission to read this'], 403);
        }

        return response()->json([
            'everyone' => [
                'count' => $this->whoCannotSignIn()->count(),
                // Named by role, because "everyone" covering the clerks a
                // departments import created is the part worth seeing before
                // pressing send.
                'by_role' => $this->whoCannotSignIn()->with('role')->get()
                    ->groupBy(fn ($user) => optional($user->role)->role ?: 'unknown')
                    ->map->count(),
            ],
            'runs' => $this->importRuns(),
        ]);
    }

    /**
     * Mail them the link that lets them choose a password.
     *
     * Queued through the job the office's bulk reset already uses, and each one
     * is the welcome mail rather than a bare reset, because
     * sendPasswordResetNotification reads the same null password_set_at.
     */
    public function sendSignInLinks(Request $request)
    {
        if (!Auth::user()->may('can_manage_users')) {
            return response()->json(['message' => 'You do not have permission to send these'], 403);
        }

        $request->validate(['batch' => 'nullable|string|max:64']);

        $emails = $this->whoCannotSignIn($request->input('batch'))->pluck('email')->all();

        if (!$emails) {
            return response()->json(['count' => 0, 'message' => 'Everybody in that group can sign in already.']);
        }

        \App\Jobs\ProcessBulkForgotPassword::dispatch($emails);

        return response()->json([
            'count' => count($emails),
            'message' => count($emails) . ' sign-in link(s) are being sent.',
        ]);
    }
    use FilterLogicTrait;

    public function listFilters(Request $request)
    {
        return response()->json($this->getAvailableFilters("users"));
    }

    public function list(Request $request)
    {
        $filters = $request->input('filters', []);
        $filtersJson = $request->query('filters');

        if ($filtersJson) {
            $filters = json_decode(urldecode($filtersJson), true);
        }

        $perPage = $request->input('rows', 15);
        $page = $request->input('page', 1);

        // Everything the rows below read, loaded once per page instead of once per row.
        $usersQuery = User::with(['role', 'current_role', 'default_role', 'ugStudent', 'student.department', 'faculty.department']);

        if ($filters) {
            $usersQuery = $this->applyDynamicFilters($usersQuery, $filters, 'users');
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
                'physically_handicapped' => (bool) $user->physically_handicapped,
                'role' => $user->role ? $user->role->role : 'N/A',
                'current_role' => $user->current_role ? $user->current_role->role : 'N/A',
                'default_role' => $user->default_role ? $user->default_role->role : 'N/A',
                'available_roles' => $user->available_roles ?? [],
                'status' => $user->status ?? 'active',
            'ug_student' => $user->ugStudent,
                'student_info' => $user->student ? [
                    // roll_number is not a column; this was always null.
                    'roll_number' => $user->student->roll_no,
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
            'physically_handicapped' => (bool) $user->physically_handicapped,
            'role_id' => $user->role_id,
            'role' => $user->role ? $user->role->role : null,
            'current_role_id' => $user->current_role_id,
            'current_role' => $user->current_role ? $user->current_role->role : null,
            'default_role_id' => $user->default_role_id,
            'default_role' => $user->default_role ? $user->default_role->role : null,
            'available_roles' => $user->available_roles ?? [],
            'status' => $user->status ?? 'active',
            'ug_student' => $user->ugStudent,
            'student_info' => $user->student,
            'faculty_info' => $user->faculty,
        ]);
    }

    /** Written only when the form sends them, so other users are untouched. */
    private function saveUgStudentRecord(User $user, Request $request): void
    {
        if (!$request->hasAny(['roll_no', 'branch_id', 'year'])) {
            return;
        }

        if (optional(Role::find($request->role_id))->role !== 'ug_student') {
            return;
        }

        $record = $user->ugStudent ?: $user->ugStudent()->make();
        $record->fill(array_filter([
            'roll_no' => $request->roll_no,
            'branch_id' => $request->branch_id,
            'year' => $request->year,
        ]));
        $user->ugStudent()->save($record);
    }

    public function createOrUpdate(Request $request)
    {
        $isUpdate = $request->has('id') && $request->id;

        $validationRules = [
            'full_name' => 'required_without:first_name|string|max:255',
            'first_name' => 'required_without:full_name|string|max:255',
            'last_name' => 'nullable|string|max:255',
            'phone' => ['required', 'string', 'max:20', Rule::unique('users', 'phone')->ignore($request->id)],
            'gender' => 'nullable|in:Male,Female',
            'physically_handicapped' => 'nullable|boolean',
            'role_id' => 'required|exists:roles,id',
            'current_role_id' => 'nullable|exists:roles,id',
            'default_role_id' => 'nullable|exists:roles,id',
            'available_roles' => 'nullable|array',
            // Was 'string', which let a typo or a crafted request store a role
            // name matching no roles row, an unswitchable, invisible dead role.
            'available_roles.*' => 'string|exists:roles,role',
            'status' => 'nullable|in:active,inactive',
            // The UG student record, which the office may correct at any time.
            'roll_no' => 'nullable|string|max:50',
            'branch_id' => 'nullable|exists:ug_branches,id',
            'year' => 'nullable|integer|between:1,4',
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
            // A password the office typed is handed over, so Change Password can
            // ask for it. One generated here is known to nobody: the account is
            // mailed a link to choose its own, and password_set_at stays null.
            $chosenByOffice = (bool) $request->password;
            $password = $request->password ?: Str::password(8, true, true, true, false);
            $user->password = Hash::make($password);
            $user->password_set_at = $chosenByOffice ? now() : null;
        }

        $name = $request->filled('full_name')
            ? PersonName::split($request->input('full_name'))
            : ['first' => $request->input('first_name'), 'last' => $request->input('last_name') ?: PersonName::NO_SURNAME];
        $user->first_name = $name['first'];
        $user->last_name = $name['last'];
        $user->email = $request->email;
        $user->phone = $request->phone;
        $user->gender = $request->gender;
        $user->physically_handicapped = $request->boolean('physically_handicapped');
        $user->role_id = $request->role_id;
        $user->current_role_id = $request->current_role_id ?? $request->role_id;
        $user->default_role_id = $request->default_role_id ?? $request->role_id;
        $user->available_roles = $request->available_roles;
        $user->status = $request->status ?? 'active';

        $user->save();

        $this->saveUgStudentRecord($user, $request);

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

        if (!$isUpdate && !$chosenByOffice) {
            $user->inviteToSetPassword();
        }

        return response()->json([
            'message' => $isUpdate ? 'User updated successfully' : 'User created successfully',
            'user' => $user,
            'warnings' => $warnings,
            // Only a password the office chose is worth reporting back. A
            // generated one is never shown: the account is mailed a link.
            'password' => !$isUpdate && $chosenByOffice ? $password : null,
        ]);
    }

    public function delete($id)
    {
        $loggedInUser = Auth::user();
        
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
        $request->validate([
            'password' => 'required|string|min:8',
        ]);

        $user = User::find($id);

        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        $user->password = Hash::make($request->password);
        $user->password_set_at = now();
        $user->save();

        return response()->json(['message' => 'Password reset successfully']);
    }

    public function sendResetEmail($id)
    {
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

    /**
     * The users sheet's rows as it has them, read by the template's own column
     * names; a sheet that splits the name gives it back whole.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array<int, array<string, mixed>>
     */
    public static function userRows(array $rows): array
    {
        $cell = fn (array $row, string $key) => (string) ($row[$key] ?? '');
        return array_map(fn (array $row) => [
            'full_name' => \App\Support\CsvRow::fallback($cell($row, 'full_name'), \App\Support\CsvRow::words($cell($row, 'first_name'), $cell($row, 'last_name'))),
            'email' => $cell($row, 'email'),
            'phone' => $cell($row, 'phone'),
            'gender' => $cell($row, 'gender'),
            'role' => $cell($row, 'role'),
            'available_roles' => $cell($row, 'available_roles'),
            'status' => \App\Support\CsvRow::fallback($cell($row, 'status'), 'active'),
            'row_number' => $row['_rowNumber'] ?? $row['row_number'] ?? null,
        ], $rows);
    }

    public function bulkImport(Request $request)
    {
        // The page posts the sheet's rows as they are; read here into the
        // batch the rules below check.
        if ($request->has('rows')) {
            $request->merge(['batch_data' => self::userRows((array) $request->input('rows'))]);
        }

        $request->validate([
            'batch_data' => 'required|array',
            'batch_data.*.full_name' => 'nullable|string',
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
                $name = PersonName::fromRow($data);

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
                    // Partial update: only overwrite provided non-empty fields.
                    // $name is null when the row carries no name at all, which
                    // must leave the stored name untouched rather than blanking it.
                    if ($name !== null) {
                        $existingUser->first_name = $name['first'];
                        $existingUser->last_name = $name['last'];
                    }
                    if (!empty($data['phone'])) $existingUser->phone = trim($data['phone']);
                    if (!empty($data['gender'])) $existingUser->gender = $data['gender'];
                    if ($role) $existingUser->role_id = $role->id;
                    if ($availableRoles !== null) $existingUser->available_roles = $availableRoles;
                    if (!empty($data['status'])) $existingUser->status = strtolower(trim($data['status']));
                    $existingUser->save();
                    $updateCount++;
                } else {
                    if ($name === null) {
                        $errors[] = "Row {$rowNumber}: full_name is required for a new user";
                        $errorCount++;
                        continue;
                    }
                    $password = Str::password(8, true, true, true, false);

                    $created = User::create([
                        'first_name' => $name['first'],
                        'last_name' => $name['last'],
                        'email' => $email,
                        // Blank, not empty string: phone carries a unique index,
                        // so a second row without one collided with the first.
                        'phone' => !empty($data['phone']) ? trim($data['phone']) : null,
                        'gender' => !empty($data['gender']) ? $data['gender'] : null,
                        'password' => Hash::make($password),
                        // Nobody knows this one, so the row is mailed a link.
                        'password_set_at' => null,
                        'role_id' => $role->id,
                        'current_role_id' => $role->id,
                        'default_role_id' => $role->id,
                        'available_roles' => $availableRoles ?? [],
                        'status' => !empty($data['status']) ? strtolower(trim($data['status'])) : 'active',
                    ]);
                    $created->inviteToSetPassword();
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
