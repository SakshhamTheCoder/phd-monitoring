<?php

namespace App\Http\Controllers\Traits;

use Illuminate\Support\Facades\Auth;

/**
 * The RBAC audit fixed six controllers by writing the same four-line guard
 * (call may(), return a 403 JSON body, otherwise null) independently, once
 * per capability. One copy means a future change to the check or the 403
 * shape happens in one place instead of drifting across six.
 */
trait AuthorizesCapability
{
    private function denyUnlessMay(string $capability, string $message): ?\Illuminate\Http\JsonResponse
    {
        if (!Auth::user()->may($capability)) {
            return response()->json(['message' => $message], 403);
        }

        return null;
    }
}
