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
        ]);

        $departmentIds = $this->clerkDepartmentIds($user->id);
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

        $students = Student::with(['user:id,first_name,last_name', 'department:id,name,code'])
            ->whereIn('department_id', $departmentIds)
            ->orderBy('roll_no')
            ->get();

        $saved = Attendance::where('date', $date)
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
                // Saved status wins; everyone else presents as present by default.
                'status' => $record?->status ?? 'present',
                'recorded' => $record !== null,
                'marked_by_name' => $record ? optional($record->markedBy)->name() : null,
            ];
        })->values();

        return response()->json([
            'date' => $date,
            'students' => $roster,
            'absent_count' => $roster->where('status', 'absent')->count(),
            'total' => $roster->count(),
        ], 200);
    }

    /**
     * Save one day's attendance. Absentees are stored as absent rows; students
     * still marked present get an explicit row too, so "present" survives a
     * later edit even though absence is the only thing reports care about.
     */
    public function save(Request $request)
    {
        $user = Auth::user();
        if ($user->current_role->role !== 'clerk') {
            return response()->json(['message' => 'You are not authorized to mark attendance'], 403);
        }

        $request->validate([
            'date' => 'required|date|before_or_equal:today',
            'records' => 'required|array|min:1',
            'records.*.roll_no' => 'required|integer',
            'records.*.status' => 'required|in:present,absent',
        ]);

        $allowedDepartmentIds = $this->clerkDepartmentIds($user->id);
        if ($allowedDepartmentIds === []) {
            return response()->json(['message' => 'No departments are assigned to you yet. Contact an administrator.'], 403);
        }

        // Reject any roll number outside the clerk's departments outright rather
        // than silently skipping it: a skipped row would look saved on screen.
        $requestedRollNos = array_column($request->input('records'), 'roll_no');
        $validRollNos = Student::whereIn('roll_no', $requestedRollNos)
            ->whereIn('department_id', $allowedDepartmentIds)
            ->pluck('roll_no')
            ->all();
        $invalid = array_diff($requestedRollNos, $validRollNos);
        if ($invalid !== []) {
            return response()->json([
                'message' => 'These roll numbers are not in your departments: ' . implode(', ', $invalid),
            ], 403);
        }

        $date = $request->input('date');
        $savedCount = 0;

        DB::transaction(function () use ($request, $user, $date, &$savedCount) {
            foreach ($request->input('records') as $record) {
                Attendance::updateOrCreate(
                    ['roll_no' => $record['roll_no'], 'date' => $date],
                    ['status' => $record['status'], 'marked_by' => $user->id]
                );
                $savedCount++;
            }
        });

        return response()->json([
            'message' => "Attendance saved for {$savedCount} student(s).",
            'saved' => $savedCount,
            'date' => $date,
        ], 200);
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
