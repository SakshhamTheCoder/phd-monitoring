<?php

use App\Http\Controllers\ConstituteOfIRBController;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\IrbSubFormController;

// Route::post('',[IrbSubFormController::class, 'load'])->middleware('auth:sanctum');
// Route::post('update',[IrbSubFormController::class, 'update'])->middleware('auth:sanctum');
// Route::post('submit',[IrbSubFormController::class, 'submit'])->middleware('auth:sanctum');

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [ConstituteOfIRBController::class, 'listForm']);
    Route::post('', [ConstituteOfIRBController::class, 'createForm']);
    Route::get('/filters', [ConstituteOfIRBController::class, 'listFilters']);
    // Before /{form_id}, which would otherwise take "bulk" for a form id.
    Route::post('/bulk', [ConstituteOfIRBController::class, 'bulkSubmit']);
    Route::get('/{form_id}', [ConstituteOfIRBController::class, 'loadForm']);
    Route::post('/{form_id}', [ConstituteOfIRBController::class, 'submit']);
});
