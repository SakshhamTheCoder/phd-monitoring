<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\DepartmentController;
use Illuminate\Support\Facades\Auth;

Route::get('',[DepartmentController::class,'list'])->middleware('auth:sanctum');    
Route::post('/add', [DepartmentController::class, 'add'])->middleware('auth:sanctum');
Route::post('/area-of-specialization/add', [DepartmentController::class, 'addAreaOfSpecialization'])->middleware('auth:sanctum');
Route::get('/area-of-specialization', [DepartmentController::class, 'getAreasOfSpecialization'])->middleware('auth:sanctum');
Route::get('/area-of-specialization/list', [DepartmentController::class, 'listAreasOfSpecialization'])->middleware('auth:sanctum');
Route::get('/area-of-specialization/filters', [DepartmentController::class, 'listAreaFilters'])->middleware('auth:sanctum');
Route::put('/area-of-specialization/update/{id}', [DepartmentController::class, 'updateAreaOfSpecialization'])->middleware('auth:sanctum');
Route::delete('/area-of-specialization/delete/{id}', [DepartmentController::class, 'deleteAreaOfSpecialization'])->middleware('auth:sanctum');
Route::post('/area-of-specialization/import', [DepartmentController::class, 'importAreasFromCSV'])->middleware('auth:sanctum');
Route::post('/add-hod', [DepartmentController::class, 'addHOD'])->middleware('auth:sanctum');
Route::post('/add-adordc', [DepartmentController::class, 'addAdordc'])->middleware('auth:sanctum');
Route::post('/add-coordinator', [DepartmentController::class, 'addCoordinator'])->middleware('auth:sanctum');
Route::delete('/remove-coordinator/{id}', [DepartmentController::class, 'removeCoordinator'])->middleware('auth:sanctum');
Route::post('/phd_coordinator', [DepartmentController::class, 'addCoordinator'])->middleware('auth:sanctum');
Route::get('/filters', [DepartmentController::class, 'listFilters']);
