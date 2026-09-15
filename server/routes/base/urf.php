<?php

use App\Http\Controllers\UrfController;
use Illuminate\Support\Facades\Route;

// Undergraduate Research Fellowship. The controller checks who may do what.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UrfController::class, 'list']);
    Route::post('/', [UrfController::class, 'apply']);
    Route::get('/filters', [UrfController::class, 'listFilters']);
    Route::get('/mine', [UrfController::class, 'mine']);
    // The forms grid: one list per form, with the shared filter bar.
    $forms = ['urf-application', 'urf-additional-info', 'urf-progress-report'];
    Route::get('/{form}', [UrfController::class, 'formList'])->whereIn('form', $forms);
    Route::get('/{form}/filters', [UrfController::class, 'listFilters'])->whereIn('form', $forms);
    Route::get('/{id}', [UrfController::class, 'show'])->whereNumber('id');
    Route::post('/{id}/status', [UrfController::class, 'setStatus'])->whereNumber('id');
    Route::post('/{id}/fellow', [UrfController::class, 'saveFellow'])->whereNumber('id');
    Route::post('/{id}/reports', [UrfController::class, 'addReport'])->whereNumber('id');
});
