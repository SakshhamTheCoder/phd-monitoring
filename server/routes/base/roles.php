<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('',function (Request $request){
    // Selects id/role only so authenticated users don't get the can_* capability columns.
    $roles = \App\Models\Role::all(['id', 'role']);
    return response()->json($roles,200);
})->middleware('auth:sanctum');