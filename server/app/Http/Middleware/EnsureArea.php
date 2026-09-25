<?php

namespace App\Http\Middleware;

use App\Support\Navigation;
use Closure;
use Illuminate\Http\Request;

/**
 * Used as area:courseManagement on a route: the acting role must be one that
 * may reach that area of the portal (config/navigation.php). The page and its
 * API then answer from the same list the menu is drawn from.
 */
class EnsureArea
{
    public function handle(Request $request, Closure $next, string $area)
    {
        if (!Navigation::allows($request->user(), $area)) {
            return response()->json(['message' => 'You are not authorized to access this resource'], 403);
        }

        return $next($request);
    }
}
