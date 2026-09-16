<?php

use App\Http\Controllers\UgStudentController;
use Illuminate\Support\Facades\Route;

// Everyone who has signed up for the URF, as a tab on the students page.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UgStudentController::class, 'list']);
    Route::get('/filters', [UgStudentController::class, 'listFilters']);
});
