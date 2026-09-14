<?php
use App\Http\Controllers\FileDownloadController;
use App\Http\Controllers\PositionApplicationController;
use Illuminate\Support\Facades\Route;

Route::post('/{applicationId}/status', [PositionApplicationController::class, 'updateStatus'])->middleware('auth:sanctum');
Route::get('/{applicationId}/resume', [FileDownloadController::class, 'resume'])->middleware('auth:sanctum');
