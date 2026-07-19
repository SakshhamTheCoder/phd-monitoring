<?php

namespace App\Http\Middleware;

use App\Support\RoleRequirements;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

/**
 * Rejects requests from a user whose *current* role has no backing record.
 *
 * Roughly thirty places across the controllers reach straight for
 * `$user->faculty->faculty_code` or `$user->student->roll_no` on the strength of
 * the current role alone. When the linkage is missing that is a null property
 * read, a 500 and a stack trace, not an authorization failure. Guarding each
 * site individually would mean thirty edits and would still miss the next one
 * someone writes.
 *
 * The invariant belongs here instead: if the role you are acting as has no data
 * behind it, you cannot make requests as it. One check, and every downstream
 * dereference is safe by construction.
 *
 * Routes that let a user *escape* a broken role are exempt, otherwise someone
 * whose data is inconsistent could not log out or switch to a role that works.
 */
class EnsureCurrentRoleIsBacked
{
    /**
     * Paths a user must always reach, even in an unusable role.
     */
    private const EXEMPT = [
        'api/switch-role',
        'api/logout',
        'api/login',
        'api/register',
        'api/user',
        'api/roles',
        // Public, token-authenticated flows. The token is the credential and no
        // user is logged in, so this middleware already no-ops, but exempting
        // them explicitly means a logged-in user with a broken role opening a
        // review or reset link in the same browser isn't refused a public page.
        'api/external-review/*',
        'api/approvals/*',
        'api/forgot-password',
        'api/reset-password',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $user = Auth::user();

        if (!$user || $this->isExempt($request)) {
            return $next($request);
        }

        $role = optional($user->current_role)->role;
        if (!$role) {
            return $next($request);
        }

        $unmet = RoleRequirements::unmet($user, $role);
        if ($unmet === null) {
            return $next($request);
        }

        // Worth logging: this is a data inconsistency an admin needs to fix, not
        // an ordinary permission denial.
        Log::warning('Blocked request from user acting in an unbacked role', [
            'user_id' => $user->id,
            'role' => $role,
            'problem' => $unmet,
            'url' => $request->fullUrl(),
        ]);

        return response()->json([
            'message' => "Your account {$unmet}, so the '{$role}' role cannot be used. "
                . 'Please contact an administrator.',
        ], 403);
    }

    private function isExempt(Request $request): bool
    {
        foreach (self::EXEMPT as $path) {
            if ($request->is($path)) {
                return true;
            }
        }

        return false;
    }
}
