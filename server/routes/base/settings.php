<?php

use App\Http\Controllers\AppSettingController;
use Illuminate\Support\Facades\Route;

// Admin-editable settings, one group per feature. The controller checks the
// group and the caller's role, so these only need authentication here.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/{group}', [AppSettingController::class, 'show']);
    Route::post('/{group}', [AppSettingController::class, 'save']);
});
