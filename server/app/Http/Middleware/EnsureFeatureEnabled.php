<?php
namespace App\Http\Middleware;

use App\Models\FeatureFlag;
use Closure;
use Illuminate\Http\Request;

/**
 * Blocks a route group when its feature is switched off.
 *
 * Answers 404 rather than 403 on purpose. A disabled module should look absent,
 * not forbidden, so nothing invites a user to go and ask for access to it.
 */
class EnsureFeatureEnabled
{
    public function handle(Request $request, Closure $next, string $feature)
    {
        if (!FeatureFlag::enabled($feature)) {
            return response()->json(['message' => 'This feature is currently unavailable.'], 404);
        }

        return $next($request);
    }
}
