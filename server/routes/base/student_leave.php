<?php

use App\Http\Controllers\StudentLeaveFormController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [StudentLeaveFormController::class, 'listForm']);
    Route::post('', [StudentLeaveFormController::class, 'createForm']);
    Route::get('/balance', [StudentLeaveFormController::class, 'balance']);
    Route::get('/{form_id}', [StudentLeaveFormController::class, 'loadForm']);
    Route::post('/{form_id}', [StudentLeaveFormController::class, 'submit']);
});
