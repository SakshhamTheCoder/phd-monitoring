<?php
use App\Http\Controllers\PositionApplicationController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PositionApplicationController::class, 'openings'])->middleware('auth:sanctum');
Route::get('/profile', [PositionApplicationController::class, 'applicantProfile'])->middleware('auth:sanctum');
Route::post('/{positionId}/apply', [PositionApplicationController::class, 'apply'])->middleware('auth:sanctum');
