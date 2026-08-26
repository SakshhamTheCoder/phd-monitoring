<?php

namespace App\Support;

use App\Models\ClerkDepartment;
use App\Models\Department;
use App\Models\PhdCoordinator;
use App\Models\User;

/**
 * Single source of truth for the data a user must actually have before a role
 * means anything.
 *
 * Roles live in two disconnected places: `users.available_roles` (a JSON array
 * of names, which is what role switching reads) and the linkage tables the
 * authorization checks read, `faculty`, `students`, `phd_coordinators`,
 * `departments.hod_id`, `departments.adordc_id`. Nothing kept those in step, so
 * a role could be granted while none of the data it depends on existed. The
 * result looked functional and silently did nothing.
 *
 * Provisioning legitimately assigns a role *before* its linkage, a Faculty row
 * needs `users.id`, so it cannot exist until after the user is saved, and admins
 * deliberately create a user shell first and attach the record later. So this is
 * NOT enforced when roles are written. It is enforced where it actually matters:
 * at the point someone tries to *act* as the role (see the /switch-role route).
 */
class RoleRequirements
{
    /**
     * Roles that need no linkage at all, pure permission roles.
     */
    private const UNRESTRICTED = ['admin', 'dra', 'dordc', 'director'];

    /**
     * Every role the system knows about, so callers can audit exhaustively.
     */
    public const ALL = [
        'admin', 'adordc', 'clerk', 'director', 'doctoral', 'dordc', 'dra',
        'external', 'faculty', 'hod', 'phd_coordinator', 'student',
    ];

    /**
     * Why this user cannot currently act as $role, or null if they can.
     *
     * Returned strings are shown to admins, so they name the missing record and
     * where to create it rather than just reporting a failure.
     */
    public static function unmet(User $user, string $role): ?string
    {
        if (in_array($role, self::UNRESTRICTED, true)) {
            return null;
        }

        if ($role === 'student') {
            return $user->student
                ? null
                : 'has no student record';
        }

        if ($role === 'clerk') {
            return ClerkDepartment::where('user_id', $user->id)->exists()
                ? null
                : 'is not assigned to any department as clerk (assign from Clerk Management)';
        }

        // Everything remaining is a faculty-shaped role, so the Faculty record
        // is the common prerequisite. Checking it first also keeps the more
        // specific checks below from dereferencing a null faculty.
        $faculty = $user->faculty;
        if (!$faculty) {
            return 'has no faculty record';
        }

        switch ($role) {
            case 'faculty':
            case 'doctoral':
            case 'external':
                return null;

            case 'phd_coordinator':
                return PhdCoordinator::where('faculty_id', $faculty->faculty_code)->exists()
                    ? null
                    : 'is not assigned as PhD Coordinator of any department (assign from the Departments page)';

            case 'hod':
                return Department::where('hod_id', $faculty->faculty_code)->exists()
                    ? null
                    : 'is not assigned as HOD of any department (assign from the Departments page)';

            case 'adordc':
                return Department::where('adordc_id', $faculty->faculty_code)->exists()
                    ? null
                    : 'is not assigned as ADORDC of any department (assign from the Departments page)';
        }

        // Unknown role name, treat as unmet rather than silently allowing it.
        return 'is not a recognised role';
    }

    /**
     * Whether the user has the data backing $role.
     */
    public static function satisfied(User $user, string $role): bool
    {
        return self::unmet($user, $role) === null;
    }

    /**
     * Warnings for every role granted to this user that has no backing data.
     *
     * Used to tell an admin what they have just created without blocking them,
     * since attaching the linkage afterwards is a supported workflow.
     *
     * @param  array<int, string>  $roles
     * @return array<int, string>
     */
    public static function warningsFor(User $user, array $roles): array
    {
        $warnings = [];

        foreach (array_unique($roles) as $role) {
            if (!is_string($role)) {
                continue;
            }
            $reason = self::unmet($user, $role);
            if ($reason !== null) {
                $warnings[] = ucfirst(str_replace('_', ' ', $role)) . ": this user {$reason}. "
                    . 'The role is saved but will not work until that exists.';
            }
        }

        return $warnings;
    }
}
