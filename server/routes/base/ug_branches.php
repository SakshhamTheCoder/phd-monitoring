<?php

use App\Http\Controllers\UgBranchController;
use Illuminate\Support\Facades\Route;

// Managing the list. Reading it is public at /urf/branches, for sign-up.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UgBranchController::class, 'index']);
    Route::post('/', [UgBranchController::class, 'store']);
    Route::post('/import', [UgBranchController::class, 'import']);
    Route::patch('/{id}', [UgBranchController::class, 'update'])->whereNumber('id');
    Route::delete('/{id}', [UgBranchController::class, 'destroy'])->whereNumber('id');
});
