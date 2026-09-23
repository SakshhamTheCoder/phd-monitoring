<?php 

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\RolesController;

// Role names for pickers. The capability columns are the portal's whole
// authorization map, so they are not sent; the client reads id and role only.
Route::get('', function (Request $request) {
    $roles = \App\Models\Role::all(['id', 'role']);
    return response()->json($roles, 200);
})->middleware('auth:sanctum');

// Creates a role with whatever capabilities the body names. Any signed-in
// account could, so it is admin only now.
Route::post('/add', [RolesController::class, 'add'])->middleware(['auth:sanctum', 'can:can_manage_users']);
