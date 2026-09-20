<?php

use App\Http\Controllers\SynopsisChecklistController;
use Illuminate\Support\Facades\Route;

// Managing the declarations a scholar picks one of on their synopsis. Scholars
// never call these: the options for their own admission year ship with the form.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [SynopsisChecklistController::class, 'index']);
    Route::post('/', [SynopsisChecklistController::class, 'store']);
    Route::patch('/{id}', [SynopsisChecklistController::class, 'update'])->whereNumber('id');
    Route::delete('/{id}', [SynopsisChecklistController::class, 'destroy'])->whereNumber('id');
});
