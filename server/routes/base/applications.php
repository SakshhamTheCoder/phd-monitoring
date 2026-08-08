<?php
use App\Http\Controllers\PositionApplicationController;
use Illuminate\Support\Facades\Route;

Route::post('/{applicationId}/status', [PositionApplicationController::class, 'updateStatus'])->middleware('auth:sanctum');
