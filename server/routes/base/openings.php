<?php
use App\Http\Controllers\PositionApplicationController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PositionApplicationController::class, 'openings'])->middleware('auth:sanctum');
Route::post('/{positionId}/apply', [PositionApplicationController::class, 'apply'])->middleware('auth:sanctum');
