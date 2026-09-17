<?php

use App\Http\Controllers\StudentLeaveFormController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [StudentLeaveFormController::class, 'listForm']);
    Route::post('', [StudentLeaveFormController::class, 'createForm']);
    Route::get('/balance', [StudentLeaveFormController::class, 'balance']);
    // Named before /{form_id}, which otherwise took "filters" for a form id
    // and refused the leave list's filter bar.
    Route::get('/filters', [StudentLeaveFormController::class, 'listFilters']);
    Route::get('/{form_id}', [StudentLeaveFormController::class, 'loadForm']);
    Route::post('/{form_id}', [StudentLeaveFormController::class, 'submit']);
    Route::delete('/{form_id}', [StudentLeaveFormController::class, 'destroyForm']);
});
