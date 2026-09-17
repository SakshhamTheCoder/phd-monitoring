<?php

use App\Http\Controllers\LogViewerController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SupervisorController;
use App\Http\Controllers\AdminFormController;
use App\Jobs\ProcessBulkForgotPassword;
use Illuminate\Support\Facades\Password;
use App\Models\User;
use App\Notifications\WelcomeResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;


Route::middleware('auth:sanctum')->group(function () {
    Route::post('/allot-supervisor', [SupervisorController::class, 'assign']);
    Route::post('/allot-doctoral', [SupervisorController::class, 'assignDoctoral']);

    Route::get('/logs', [LogViewerController::class, 'fetchLogs']);
});

// Moving, disabling or deleting a scholar's form instances. None of these methods
// checks the caller, so without this gate any signed-in account could.
Route::middleware(['auth:sanctum', 'can:can_manage_form_levels'])->group(function () {
    Route::get('/forms/student/{student_id}', [AdminFormController::class, 'getStudentForms']);
    Route::post('/forms/create', [AdminFormController::class, 'createFormInstance']);
    Route::post('/forms/update-control', [AdminFormController::class, 'updateFormControl']);
    Route::post('/forms/toggle-availability', [AdminFormController::class, 'toggleFormAvailability']);
    Route::post('/forms/update-stage', [AdminFormController::class, 'updateGeneralFormStage']);
    Route::post('/forms/disable', [AdminFormController::class, 'disableForm']);
    Route::delete('/forms/delete', [AdminFormController::class, 'deleteFormInstance']);
});

// Sends a reset mail to every address given. Ungated, any account could mail
// the whole portal.
Route::middleware(['auth:sanctum', 'can:can_manage_users'])->post('/bulk-forgot-password', function (Request $request) {
    $emails = $request->input('emails', []);

    Log::info('Queued bulk reset for: ', $emails);

    ProcessBulkForgotPassword::dispatch($emails);

    return response()->json([
        'status' => 'success',
        'message' => 'Reset links are being processed in the background.'
    ]);
});
