<?php


use Illuminate\Support\Facades\Route;
use App\Http\Controllers\IrbSubController;
use App\Models\IrbSubForm;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [IrbSubController::class, 'listForm']);
    Route::post('', [IrbSubController::class, 'createForm']);
    Route::get('/filters', [IrbSubController::class, 'listFilters']);

    // Before /{form_id}, which would otherwise take "bulk" for a form id.
    Route::post('/bulk', [IrbSubController::class, 'bulkSubmit']);
    Route::get('/{form_id}', [IrbSubController::class, 'loadForm']);
    Route::post('/{form_id}', [IrbSubController::class, 'submit']);
});
