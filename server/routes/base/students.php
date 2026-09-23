<?php

use App\Http\Controllers\SemesterController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
// use App\Models\Role;
// use Faker\Generator;
use Illuminate\Support\Facades\App;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\UserController;

Route::get('/', [StudentController::class, 'list'])->middleware('auth:sanctum');
// Declared before the '{id}' group below, or 'me' is read as a roll number.
Route::get('/me', [StudentController::class, 'me'])->middleware('auth:sanctum');
 

Route::post('/add', [StudentController::class, 'add'])->middleware('auth:sanctum');
Route::post('/bulk-upload', [StudentController::class, 'bulkUpload'])->middleware('auth:sanctum');
Route::post('/bulk-update', [StudentController::class, 'bulkUpdate'])->middleware('auth:sanctum');

Route::get('/filters', [StudentController::class, 'listFilters'])->middleware('auth:sanctum');

Route::prefix('{id}')->group(function () {
    Route::get('', [StudentController::class, 'get'])->middleware('auth:sanctum');
    // Two writes, as on the faculty side: '/profile' is the soft half a scholar
    // keeps current, '/update' the provisioning half only a privileged role sets.
    Route::post('/profile', [StudentController::class, 'updateProfile'])->middleware('auth:sanctum');
    Route::post('/update', [StudentController::class, 'adminUpdate'])->middleware('auth:sanctum');
    Route::post('/outside-expert', [StudentController::class, 'setOutsideExpert'])->middleware('auth:sanctum');

    Route::get('/forms', [UserController::class, 'listForms'])->middleware('auth:sanctum');

    // The progress chart on the scholar's profile. Gated by Student::isReadableBy,
    // the same rule the profile itself uses, so what the page shows and what it
    // may fetch cannot disagree.
    Route::get('/progress-history', [StudentController::class, 'progressHistory'])->middleware('auth:sanctum');

    // The scholar's publications, on the same gate. /publications answers only
    // for the signed-in account, so without this nobody could read a scholar's
    // work from the scholar's own page.
    Route::get('/publications', [StudentController::class, 'publications'])->middleware('auth:sanctum');

    Route::prefix('/forms')->group(function () {
        // Route::middleware('parseRollNumber')->group(function () {
            require base_path('routes/base/forms.php');
        // });
    });
      
    
});