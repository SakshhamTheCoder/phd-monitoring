<?php

use App\Http\Controllers\UgBranchController;
use Illuminate\Support\Facades\Route;

// The branch list, as the admin manages it. Reading the list for a dropdown is
// public and lives at /urf/branches, since sign-up needs it before there is an
// account.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UgBranchController::class, 'index']);
    Route::post('/', [UgBranchController::class, 'store']);
    Route::patch('/{id}', [UgBranchController::class, 'update'])->whereNumber('id');
    Route::delete('/{id}', [UgBranchController::class, 'destroy'])->whereNumber('id');
});
