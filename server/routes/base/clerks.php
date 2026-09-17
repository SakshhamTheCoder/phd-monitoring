<?php

use App\Http\Controllers\ClerkController;
use Illuminate\Support\Facades\Route;

// Clerk-facing attendance. The gate is stated here rather than repeated as the
// first three lines of nine controller methods, so who may mark attendance can
// be read off the route table.
Route::middleware(['auth:sanctum', 'can:can_read_own_clerk_departments'])->group(function () {
    Route::get('/my-departments', [ClerkController::class, 'myDepartments']);
});

Route::middleware(['auth:sanctum', 'can:can_mark_attendance'])->group(function () {
    Route::get('/attendance', [ClerkController::class, 'roster']);
    Route::get('/attendance/history', [ClerkController::class, 'history']);
    Route::get('/attendance/template', [ClerkController::class, 'template']);
    Route::get('/attendance/export', [ClerkController::class, 'export']);
    Route::get('/attendance/summary', [ClerkController::class, 'daySummary']);
    Route::get('/attendance/month', [ClerkController::class, 'monthSummary']);
    Route::post('/attendance', [ClerkController::class, 'save']);
    Route::post('/attendance/csv', [ClerkController::class, 'csvImport']);
});

// studentAttendance branches on can_read_leave_reason to decide what to include,
// so its check is scoping and stays in the method.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/attendance/student/{roll_no}', [ClerkController::class, 'studentAttendance']);
});

// Admin-side clerk management (tagging clerks with departments).
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [ClerkController::class, 'listClerks']);
    Route::get('/filters', [ClerkController::class, 'listFilters']);
    Route::post('/bulk-update', [ClerkController::class, 'bulkUpdate']);
    Route::post('/{userId}/departments', [ClerkController::class, 'syncDepartments']);
    Route::delete('/{userId}/departments/{departmentId}', [ClerkController::class, 'detachDepartment']);
});
