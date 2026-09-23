<?php

use App\Http\Controllers\ReviseTitleController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [ReviseTitleController::class, 'listForm']);
    Route::post('', [ReviseTitleController::class, 'createForm']);
    Route::post('/bulk', [ReviseTitleController::class, 'bulkSubmit']);
    Route::get('/filters', [ReviseTitleController::class, 'listFilters']);
    Route::get('/{form_id}', [ReviseTitleController::class, 'loadForm']);
    Route::post('/{form_id}', [ReviseTitleController::class, 'submit']);
});
