<?php
use App\Http\Controllers\ProjectController;
use Illuminate\Support\Facades\Route;

Route::get('/stats', [ProjectController::class, 'stats'])->middleware('auth:sanctum');
Route::get('/', [ProjectController::class, 'index'])->middleware('auth:sanctum');
Route::post('/', [ProjectController::class, 'store'])->middleware('auth:sanctum');
Route::get('/{id}', [ProjectController::class, 'show'])->middleware('auth:sanctum');
Route::post('/{id}', [ProjectController::class, 'update'])->middleware('auth:sanctum');
Route::delete('/{id}', [ProjectController::class, 'destroy'])->middleware('auth:sanctum');
