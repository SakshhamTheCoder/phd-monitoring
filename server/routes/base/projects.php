<?php
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectMilestoneController;
use App\Http\Controllers\ProjectDocumentController;
use Illuminate\Support\Facades\Route;

Route::get('/stats', [ProjectController::class, 'stats'])->middleware('auth:sanctum');
Route::get('/', [ProjectController::class, 'index'])->middleware('auth:sanctum');
Route::post('/', [ProjectController::class, 'store'])->middleware('auth:sanctum');
Route::get('/{id}', [ProjectController::class, 'show'])->middleware('auth:sanctum');
Route::post('/{id}', [ProjectController::class, 'update'])->middleware('auth:sanctum');
Route::delete('/{id}', [ProjectController::class, 'destroy'])->middleware('auth:sanctum');
Route::post('/{id}/milestones', [ProjectMilestoneController::class, 'store'])->middleware('auth:sanctum');
Route::post('/{id}/milestones/{milestoneId}', [ProjectMilestoneController::class, 'update'])->middleware('auth:sanctum');
Route::delete('/{id}/milestones/{milestoneId}', [ProjectMilestoneController::class, 'destroy'])->middleware('auth:sanctum');
Route::post('/{id}/documents', [ProjectDocumentController::class, 'store'])->middleware('auth:sanctum');
Route::delete('/{id}/documents/{documentId}', [ProjectDocumentController::class, 'destroy'])->middleware('auth:sanctum');
