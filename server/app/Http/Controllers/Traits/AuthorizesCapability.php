<?php

namespace App\Http\Controllers\Traits;

use Illuminate\Support\Facades\Auth;

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
