<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\ClerkDepartment;
use App\Models\Department;
use App\Models\Role;
use App\Models\Student;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * Attendance for PhD scholars, and the admin-side tagging of clerks to
 * departments.
 *
 * A clerk's authorization is entirely relational: the role itself grants
 * nothing, every endpoint resolves the acting user's clerk_departments rows and
 * only students of those departments are ever readable or writable through it.
 */
class ClerkController extends Controller
{
    /**
     * Department ids the given user is tagged with as clerk.
     *
     * @return array<int, int>
     */
    private function clerkDepartmentIds(int $userId): array
    {
        return ClerkDepartment::where('user_id', $userId)->pluck('department_id')->all();
    }

    /**
     * The departments the acting clerk covers, so their UI can label the roster.
     */
    public function myDepartments(Request $request)
    {
        $user = Auth::user();
        if ($user->current_role->role !== 'clerk') {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        $departments = Department::whereIn('id', $this->clerkDepartmentIds($user->id))
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json([
            'departments' => $departments,
        ], 200);
    }

    /**
     * The day's roster for the acting clerk: every student in their departments,
     * each pre-filled with saved attendance for the date or a present default.
     *
     * The default is deliberately client-side presentation, not storage — nothing
     * is written until the clerk saves, so an untouched day stays "not taken".
     */
    public function roster(Request $request)
    {
        $user = Auth::user();

        // Admins get read access for oversight; only clerks can write (save()).
        if (!in_array($user->current_role->role, ['clerk', 'admin'], true)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        $request->validate([
            'date' => 'nullable|date',
            'department_id' => 'nullable|integer',
            'lecture_id' => 'nullable|integer|min:0',
        ]);

        // Admin bypasses department scoping for oversight
        if ($user->current_role->role === 'admin') {
            $departmentIds = Department::pluck('id')->all();
        } else {
            $departmentIds = $this->clerkDepartmentIds($user->id);
        }
        if ($request->filled('department_id')) {
            $departmentIds = array_values(array_intersect(
                $departmentIds,
                [(int) $request->input('department_id')]
            ));
        }
        if ($departmentIds === []) {
            return response()->json([
                'date' => $request->input('date', now()->toDateString()),
                'students' => [],
                'message' => 'No departments are assigned to you yet. Contact an administrator.',
            ], 200);
        }

        $date = $request->input('date', now()->toDateString());
        $lectureId = (int) ($request->input('lecture_id', 0));

        $students = Student::with(['user:id,first_name,last_name', 'department:id,name,code'])
            ->whereIn('department_id', $departmentIds)
            ->orderBy('roll_no')
            ->get();

        $saved = Attendance::where('date', $date)
            ->where('lecture_id', $lectureId)
            ->whereIn('roll_no', $students->pluck('roll_no'))
            ->get()
            ->keyBy('roll_no');

        $roster = $students->map(function ($student) use ($saved, $date) {
            $record = $saved->get($student->roll_no);

            return [
                'roll_no' => $student->roll_no,
                'name' => optional($student->user)->name(),
                'department_id' => $student->department_id,
                'department_name' => optional($student->department)->name,
                'department_code' => optional($student->department)->code,
                'current_status' => $student->current_status,
                // null when not yet taken — lets the client distinguish "not recorded" from explicit present
                'status' => $record?->status,
                'recorded' => $record !== null,
                'marked_by_name' => $record ? optional($record->markedBy)->name() : null,
            ];
        })->values();

        return response()->json([
            'date' => $date,
            'students' => $roster,
            'absent_count' => $roster->where('status', 'absent')->count(),
            'total' => $roster->count(),
            'recorded_count' => $roster->where('recorded', true)->count(),
        ], 200);
    }

    /**
     * Save one day's attendance. Absentees are stored as absent rows; students
     * still marked present get an explicit row too, so "present" survives a
     * later edit even though absence is the only thing reports care about.
     *
     * Constraints: roll_no+date+lecture_id unique, not before date_of_registration,
     * only clerk's departments, and clerk edit window (config attendance.edit_window_days).
     * Admin bypasses the window.
     */
    public function save(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role->role;
        if (!in_array($role, ['clerk', 'admin'], true)) {
            return response()->json(['message' => 'You are not authorized to mark attendance'], 403);
        }

        $request->validate([
            'date' => 'required|date|before_or_equal:today',
            'lecture_id' => 'nullable|integer|min:0',
            'records' => 'required|array|min:1',
            'records.*.roll_no' => 'required|integer',
            'records.*.status' => 'required|in:present,absent',
        ]);

        $lectureId = (int) ($request->input('lecture_id', 0));

        // Edit window: clerk can only edit within N days, admin unlimited
        if ($role === 'clerk') {
            $window = (int) config('attendance.edit_window_days', 7);
            $date = \Carbon\Carbon::parse($request->input('date'));
            $daysAgo = now()->startOfDay()->diffInDays($date->copy()->startOfDay(), false);
            // daysAgo negative means date is in past
            if ($daysAgo < -$window) {
                return response()->json([
                    'message' => "You can only edit attendance for the last {$window} days. Contact an admin for older records.",
                ], 403);
            }
        }

        // Clerks are department-scoped, admins are not
        $allowedDepartmentIds = $role === 'admin' ? null : $this->clerkDepartmentIds($user->id);
        if ($role !== 'admin' && $allowedDepartmentIds === []) {
            return response()->json(['message' => 'No departments are assigned to you yet. Contact an administrator.'], 403);
        }

        $requestedRollNos = array_column($request->input('records'), 'roll_no');
        $students = Student::whereIn('roll_no', $requestedRollNos)
            ->when($allowedDepartmentIds !== null, fn ($q) => $q->whereIn('department_id', $allowedDepartmentIds))
            ->get()
            ->keyBy('roll_no');

        $invalid = array_diff($requestedRollNos, $students->keys()->all());
        if ($invalid !== []) {
            return response()->json([
                'message' => 'These roll numbers are not in your departments: ' . implode(', ', $invalid),
            ], 403);
        }

        // Not before date_of_registration
        $dateStr = $request->input('date');
        $dateCarbon = \Carbon\Carbon::parse($dateStr)->startOfDay();
        $beforeRegistration = [];
        foreach ($students as $roll => $stu) {
            if ($stu->date_of_registration) {
                $reg = \Carbon\Carbon::parse($stu->date_of_registration)->startOfDay();
                if ($dateCarbon->lt($reg)) {
                    $beforeRegistration[] = $roll;
                }
            }
        }
        if ($beforeRegistration !== []) {
            return response()->json([
                'message' => 'Date is before registration for: ' . implode(', ', $beforeRegistration),
            ], 422);
        }

        $date = $request->input('date');
        $savedCount = 0;

        DB::transaction(function () use ($request, $user, $date, $lectureId, &$savedCount) {
            foreach ($request->input('records') as $record) {
                $existing = Attendance::where('roll_no', $record['roll_no'])
                    ->where('date', $date)
                    ->where('lecture_id', $lectureId)
                    ->first();
                $oldStatus = $existing?->status;

                $attendance = Attendance::updateOrCreate(
                    ['roll_no' => $record['roll_no'], 'date' => $date, 'lecture_id' => $lectureId],
                    ['status' => $record['status'], 'marked_by' => $user->id]
                );
                $savedCount++;

                // History for diff/audit
                if ($oldStatus !== null && $oldStatus !== $record['status']) {
                    \App\Models\AttendanceHistory::create([
                        'attendance_id' => $attendance->id,
                        'roll_no' => $record['roll_no'],
                        'date' => $date,
                        'lecture_id' => $lectureId,
                        'old_status' => $oldStatus,
                        'new_status' => $record['status'],
                        'changed_by' => $user->id,
                    ]);
                } elseif ($oldStatus === null) {
                    \App\Models\AttendanceHistory::create([
                        'attendance_id' => $attendance->id,
                        'roll_no' => $record['roll_no'],
                        'date' => $date,
                        'lecture_id' => $lectureId,
                        'old_status' => null,
                        'new_status' => $record['status'],
                        'changed_by' => $user->id,
                    ]);
                }
            }
        });

        return response()->json([
            'message' => "Attendance saved for {$savedCount} student(s).",
            'saved' => $savedCount,
            'date' => $date,
        ], 200);
    }

    /**
     * CSV template for attendance upload.
     */
    public function template(Request $request)
    {
        $user = Auth::user();
        if (!in_array($user->current_role->role, ['clerk', 'admin'], true)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }
        $csv = "roll_no,date,status\n123,2026-08-26,present\n124,2026-08-26,absent\n";
        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="attendance_template.csv"',
        ]);
    }

    /**
     * Bulk CSV import: columns roll_no,date,status (lecture_id optional).
     * Validates dept scope, date range, edit window, returns created/updated/skipped/errors.
     */
    public function csvImport(Request $request)
    {
        $user = Auth::user();
        $role = $user->current_role->role;
        if (!in_array($role, ['clerk', 'admin'], true)) {
            return response()->json(['message' => 'You are not authorized to import attendance'], 403);
        }

        $request->validate([
            'file' => 'required|file|mimes:csv,txt|max:2048',
            'lecture_id' => 'nullable|integer|min:0',
        ]);

        $lectureId = (int) ($request->input('lecture_id', 0));
        $allowedDepartmentIds = $role === 'admin' ? null : $this->clerkDepartmentIds($user->id);
        if ($role !== 'admin' && $allowedDepartmentIds === []) {
            return response()->json(['message' => 'No departments are assigned to you yet.'], 403);
        }

        $file = $request->file('file');
        $content = file_get_contents($file->getRealPath());
        $lines = array_filter(array_map('trim', explode("\n", $content)));
        if (count($lines) < 2) {
            return response()->json(['message' => 'CSV is empty or missing header'], 422);
        }

        $header = array_map('trim', str_getcsv(array_shift($lines)));
        $header = array_map('strtolower', $header);
        $required = ['roll_no', 'date', 'status'];
        foreach ($required as $col) {
            if (!in_array($col, $header, true)) {
                return response()->json(['message' => "Missing required column: {$col}"], 422);
            }
        }

        $idxRoll = array_search('roll_no', $header, true);
        $idxDate = array_search('date', $header, true);
        $idxStatus = array_search('status', $header, true);
        $idxLecture = array_search('lecture_id', $header, true);

        $created = 0; $updated = 0; $skipped = 0;
        $errors = [];
        $window = (int) config('attendance.edit_window_days', 7);

        DB::beginTransaction();
        try {
            foreach ($lines as $lineNo => $line) {
                $rowNum = $lineNo + 2;
                $cols = str_getcsv($line);
                $rollRaw = trim($cols[$idxRoll] ?? '');
                $dateRaw = trim($cols[$idxDate] ?? '');
                $statusRaw = strtolower(trim($cols[$idxStatus] ?? ''));
                $lecRaw = $idxLecture !== false ? trim($cols[$idxLecture] ?? '') : '';

                if ($rollRaw === '' || $dateRaw === '' || $statusRaw === '') {
                    $errors[] = "Row {$rowNum}: missing roll_no/date/status";
                    continue;
                }
                if (!ctype_digit($rollRaw)) {
                    $errors[] = "Row {$rowNum}: roll_no must be integer";
                    continue;
                }
                $roll = (int) $rollRaw;
                if (!in_array($statusRaw, ['present', 'absent'], true)) {
                    $errors[] = "Row {$rowNum}: status must be present/absent";
                    continue;
                }
                try { $date = \Carbon\Carbon::parse($dateRaw)->toDateString(); } catch (\Throwable $e) {
                    $errors[] = "Row {$rowNum}: invalid date";
                    continue;
                }
                if (\Carbon\Carbon::parse($date)->isAfter(now()->startOfDay())) {
                    $errors[] = "Row {$rowNum}: date cannot be in future";
                    continue;
                }
                if ($role === 'clerk' && \Carbon\Carbon::parse($date)->lt(now()->startOfDay()->subDays($window))) {
                    $errors[] = "Row {$rowNum}: beyond {$window}-day edit window";
                    continue;
                }
                $lec = $lecRaw !== '' ? (int) $lecRaw : $lectureId;

                $student = Student::where('roll_no', $roll)
                    ->when($allowedDepartmentIds !== null, fn ($q) => $q->whereIn('department_id', $allowedDepartmentIds))
                    ->first();
                if (!$student) {
                    $errors[] = "Row {$rowNum}: roll {$roll} not in your departments";
                    continue;
                }
                if ($student->date_of_registration && \Carbon\Carbon::parse($date)->lt(\Carbon\Carbon::parse($student->date_of_registration)->startOfDay())) {
                    $errors[] = "Row {$rowNum}: date before registration for {$roll}";
                    continue;
                }

                $existing = Attendance::where('roll_no', $roll)->where('date', $date)->where('lecture_id', $lec)->first();
                if ($existing && $existing->status === $statusRaw) {
                    $skipped++;
                    continue;
                }
                $oldStatus = $existing?->status;
                $attendance = Attendance::updateOrCreate(
                    ['roll_no' => $roll, 'date' => $date, 'lecture_id' => $lec],
                    ['status' => $statusRaw, 'marked_by' => $user->id]
                );
                if ($existing) $updated++; else $created++;

                \App\Models\AttendanceHistory::create([
                    'attendance_id' => $attendance->id,
                    'roll_no' => $roll,
                    'date' => $date,
                    'lecture_id' => $lec,
                    'old_status' => $oldStatus,
                    'new_status' => $statusRaw,
                    'changed_by' => $user->id,
                ]);
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 500);
        }

        return response()->json([
            'message' => "Import done: {$created} created, {$updated} updated, {$skipped} skipped, " . count($errors) . " errors",
            'data' => [
                'created' => $created,
                'updated' => $updated,
                'skipped' => $skipped,
                'error_count' => count($errors),
                'errors' => $errors,
            ],
        ], 200);
    }

    /**
     * Export attendance as CSV for a date range (and optional department/lecture).
     */
    public function export(Request $request)
    {
        $user = Auth::user();
        if (!in_array($user->current_role->role, ['clerk', 'admin'], true)) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'from' => 'nullable|date',
            'to' => 'nullable|date|after_or_equal:from',
            'department_id' => 'nullable|integer|exists:departments,id',
            'lecture_id' => 'nullable|integer|min:0',
        ]);

        $allowedDepartmentIds = $user->current_role->role === 'admin' ? null : $this->clerkDepartmentIds($user->id);
        $deptIds = $allowedDepartmentIds;
        if ($request->filled('department_id')) {
            $deptIds = $allowedDepartmentIds === null
                ? [(int) $request->input('department_id')]
                : array_values(array_intersect($allowedDepartmentIds, [(int) $request->input('department_id')]));
        }
        if ($deptIds !== null && $deptIds === []) {
            return response()->json(['message' => 'No departments in scope'], 403);
        }

        $query = Attendance::query()->orderBy('date')->orderBy('roll_no');
        if ($request->filled('from')) $query->where('date', '>=', $request->input('from'));
        if ($request->filled('to')) $query->where('date', '<=', $request->input('to'));
        if ($request->filled('lecture_id')) $query->where('lecture_id', (int) $request->input('lecture_id'));
        if ($deptIds !== null) {
            $rolls = Student::whereIn('department_id', $deptIds)->pluck('roll_no');
            $query->whereIn('roll_no', $rolls);
        }

        $rows = $query->get(['roll_no', 'date', 'lecture_id', 'status', 'marked_by']);
        $csv = "roll_no,date,lecture_id,status\n";
        foreach ($rows as $r) {
            $csv .= "{$r->roll_no},{$r->date},{$r->lecture_id},{$r->status}\n";
        }

        $filename = 'attendance_export_' . now()->toDateString() . '.csv';
        return response($csv, 200, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
        ]);
    }

    // -----------------------------------------------------------------------
    // Admin-side clerk management
    // -----------------------------------------------------------------------

    /**
     * Guard for the management endpoints below: admins only.
     */
    private function authorizeAdmin(): ?\Illuminate\Http\JsonResponse
    {
        if (Auth::user()->current_role->role !== 'admin') {
            return response()->json(['message' => 'You are not authorized to manage clerks'], 403);
        }
        return null;
    }

    /**
     * Every clerk account with its department taggings, for the admin page.
     */
    public function listClerks(Request $request)
    {
        if ($response = $this->authorizeAdmin()) {
            return $response;
        }

        $clerkRole = Role::where('role', 'clerk')->first();

        // A clerk is either someone whose primary role is clerk or a user the
        // admin added 'clerk' to via available_roles.
        $users = \App\Models\User::where(function ($query) use ($clerkRole) {
            $query->when($clerkRole, fn ($q) => $q->where('role_id', $clerkRole->id))
                ->orWhereJsonContains('available_roles', 'clerk');
        })
            ->with(['clerkDepartments.department:id,name,code'])
            ->orderBy('first_name')
            ->get();

        $result = $users->map(function ($user) {
            return [
                'id' => $user->id,
                'name' => $user->name(),
                'email' => $user->email,
                'phone' => $user->phone,
                'status' => $user->status,
                'departments' => $user->clerkDepartments->map(function ($link) {
                    return [
                        'link_id' => $link->id,
                        'department_id' => $link->department_id,
                        'name' => optional($link->department)->name,
                        'code' => optional($link->department)->code,
                    ];
                })->values(),
            ];
        });

        return response()->json([
            'data' => $result->values(),
        ], 200);
    }

    /**
     * Tag departments onto a clerk. Accepts the full desired department id list
     * and syncs, so adding and removing is the same operation from the UI.
     */
    public function syncDepartments(Request $request, $userId)
    {
        if ($response = $this->authorizeAdmin()) {
            return $response;
        }

        $request->validate([
            'department_ids' => 'required|array',
            'department_ids.*' => 'integer|exists:departments,id',
        ]);

        $user = \App\Models\User::find($userId);
        if (!$user) {
            return response()->json(['message' => 'User not found'], 404);
        }

        DB::transaction(function () use ($request, $user) {
            ClerkDepartment::where('user_id', $user->id)
                ->whereNotIn('department_id', $request->input('department_ids'))
                ->delete();

            foreach ($request->input('department_ids') as $departmentId) {
                ClerkDepartment::firstOrCreate([
                    'user_id' => $user->id,
                    'department_id' => $departmentId,
                ]);
            }
        });

        $departments = Department::whereIn('id', $this->clerkDepartmentIds($user->id))
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json([
            'message' => 'Departments updated for ' . $user->name(),
            'departments' => $departments,
        ], 200);
    }

    /**
     * Remove a single department tagging from a clerk.
     */
    public function detachDepartment(Request $request, $userId, $departmentId)
    {
        if ($response = $this->authorizeAdmin()) {
            return $response;
        }

        $deleted = ClerkDepartment::where('user_id', $userId)
            ->where('department_id', $departmentId)
            ->delete();

        if (!$deleted) {
            return response()->json(['message' => 'This clerk is not assigned to that department'], 404);
        }

        return response()->json(['message' => 'Department removed from clerk'], 200);
    }
}
