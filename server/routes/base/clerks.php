<?php

use App\Http\Controllers\ClerkController;
use Illuminate\Support\Facades\Route;

// Clerk-facing attendance. The controller re-checks the current role on every
// endpoint, so these only need authentication here.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/my-departments', [ClerkController::class, 'myDepartments']);
    Route::get('/attendance', [ClerkController::class, 'roster']);
    Route::get('/attendance/history', [ClerkController::class, 'history']);
    Route::get('/attendance/template', [ClerkController::class, 'template']);
    Route::get('/attendance/export', [ClerkController::class, 'export']);
    Route::get('/attendance/summary', [ClerkController::class, 'daySummary']);
    Route::get('/attendance/month', [ClerkController::class, 'monthSummary']);
    Route::get('/attendance/student/{roll_no}', [ClerkController::class, 'studentAttendance']);
    Route::post('/attendance', [ClerkController::class, 'save']);
    Route::post('/attendance/csv', [ClerkController::class, 'csvImport']);
});

// Admin-side clerk management (tagging clerks with departments).
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [ClerkController::class, 'listClerks']);
    Route::post('/bulk-update', [ClerkController::class, 'bulkUpdate']);
    Route::post('/{userId}/departments', [ClerkController::class, 'syncDepartments']);
    Route::delete('/{userId}/departments/{departmentId}', [ClerkController::class, 'detachDepartment']);
});
