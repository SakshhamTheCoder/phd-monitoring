<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::get('',function (Request $request){
    // Every user sees role names through the role switcher already, so this only
    // needs to stay out of anonymous hands and not leak the can_* capability columns.
    $roles = \App\Models\Role::all(['id', 'role']);
    return response()->json($roles,200);
})->middleware('auth:sanctum');