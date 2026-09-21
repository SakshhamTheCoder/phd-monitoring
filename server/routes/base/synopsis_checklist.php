<?php

use App\Http\Controllers\SynopsisChecklistController;
use Illuminate\Support\Facades\Route;

// Managing the declarations a synopsis picks one of: the conditions that decide
// who is offered what, and the wording under each. Nobody filling a form calls
// these: the options a scholar qualifies for ship with the form.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [SynopsisChecklistController::class, 'index']);

    Route::post('/rules', [SynopsisChecklistController::class, 'storeRule']);
    Route::patch('/rules/{id}', [SynopsisChecklistController::class, 'updateRule'])->whereNumber('id');
    Route::delete('/rules/{id}', [SynopsisChecklistController::class, 'destroyRule'])->whereNumber('id');

    Route::post('/', [SynopsisChecklistController::class, 'store']);
    Route::patch('/{id}', [SynopsisChecklistController::class, 'update'])->whereNumber('id');
    Route::delete('/{id}', [SynopsisChecklistController::class, 'destroy'])->whereNumber('id');
});
