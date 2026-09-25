<?php
use App\Http\Controllers\PositionApplicationController;
use Illuminate\Support\Facades\Route;

Route::get('/', [PositionApplicationController::class, 'openings'])->middleware('auth:sanctum');
Route::get('/profile', [PositionApplicationController::class, 'applicantProfile'])->middleware('auth:sanctum');
Route::post('/{positionId}/apply', [PositionApplicationController::class, 'apply'])->middleware('auth:sanctum');
// The board as the scholar sees it, each value phrased (App\Pages\OpeningsPage).
Route::get('/board', function () {
    abort_unless((new \App\Pages\OpeningsPage())->allows(\Illuminate\Support\Facades\Auth::user()), 403);
    return response()->json(\App\Pages\OpeningsPage::board());
})->middleware('auth:sanctum');
