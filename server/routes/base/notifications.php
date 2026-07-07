<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\NotificationsController;


Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [NotificationsController::class, 'allNotifications']);
    Route::get('/unread', [NotificationsController::class, 'unreadNotifications']);
    Route::put('/mark-as-read/{id}', [NotificationsController::class, 'markAsRead']);
    Route::put('/mark-all-as-read', [NotificationsController::class, 'markAllAsRead']);
  });
