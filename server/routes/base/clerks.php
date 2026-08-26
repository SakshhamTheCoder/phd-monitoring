<?php

use App\Http\Controllers\ClerkController;
use Illuminate\Support\Facades\Route;

// Clerk-facing attendance. The controller re-checks the current role on every
// endpoint, so these only need authentication here.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/my-departments', [ClerkController::class, 'myDepartments']);
    Route::get('/attendance', [ClerkController::class, 'roster']);
    Route::post('/attendance', [ClerkController::class, 'save']);
});

// Admin-side clerk management (tagging clerks with departments).
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [ClerkController::class, 'listClerks']);
    Route::post('/{userId}/departments', [ClerkController::class, 'syncDepartments']);
    Route::delete('/{userId}/departments/{departmentId}', [ClerkController::class, 'detachDepartment']);
});
