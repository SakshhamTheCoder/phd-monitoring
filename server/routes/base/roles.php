<?php 

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RolesController;

// The capability matrix is the portal's whole authorization map. It was
// readable without signing in; the only caller is the admin's clerk form.
Route::get('', function (Request $request) {
    $roles = \App\Models\Role::all();
    return response()->json($roles, 200);
})->middleware('auth:sanctum');

// Creates a role with whatever capabilities the body names. Any signed-in
// account could, so it is admin only now.
Route::post('/add', [RolesController::class, 'add'])->middleware(['auth:sanctum', 'can:can_manage_users']);
