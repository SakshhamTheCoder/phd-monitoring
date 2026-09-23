<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SupervisorController;

Route::post('/assign', [SupervisorController::class, 'assign'])->middleware('auth:sanctum');