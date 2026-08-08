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
Route::post('/update-profile', [StudentController::class, 'updateProfile'])->middleware('auth:sanctum');
 

Route::post('/add', [StudentController::class, 'add'])->middleware('auth:sanctum');
Route::post('/bulk-upload', [StudentController::class, 'bulkUpload'])->middleware('auth:sanctum');
Route::get('/filters', [StudentController::class, 'listFilters'])->middleware('auth:sanctum');

Route::prefix('{id}')->group(function () {
    Route::get('', [StudentController::class, 'get'])->middleware('auth:sanctum');
    Route::post('/update', [StudentController::class, 'adminUpdate'])->middleware('auth:sanctum');

    Route::get('/forms', [UserController::class, 'listForms'])->middleware('auth:sanctum');

    Route::prefix('/forms')->group(function () {
        // Route::middleware('parseRollNumber')->group(function () {
            require base_path('routes/base/forms.php');
        // });
    });
      
    
});