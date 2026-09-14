<?php


use Illuminate\Support\Facades\Route;
use App\Http\Controllers\IrbSubController;
use App\Models\IrbSubForm;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [IrbSubController::class, 'listForm']);
    Route::post('', [IrbSubController::class, 'createForm']);
    Route::post('/bulk', [IrbSubController::class, 'bulkSubmit'])->name('form.bulk.create');
    Route::get('/filters', [IrbSubController::class, 'listFilters']);

    Route::get('/{form_id}', [IrbSubController::class, 'loadForm']);
    Route::post('/{form_id}', [IrbSubController::class, 'submit']);
});
