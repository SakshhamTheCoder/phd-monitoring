<?php

use App\Http\Controllers\UgStudentController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UgStudentController::class, 'list']);
    Route::get('/filters', [UgStudentController::class, 'listFilters']);
    Route::post('/', [UgStudentController::class, 'store']);
    Route::post('/import', [UgStudentController::class, 'bulkImport']);
    Route::patch('/{user}', [UgStudentController::class, 'update'])->whereNumber('user');
});
