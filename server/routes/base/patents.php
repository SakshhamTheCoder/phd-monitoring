<?php

use App\Http\Controllers\PatentsController;
use Illuminate\Support\Facades\Route;



Route::post('/', [PatentsController::class, 'store'])->middleware('auth:sanctum');
Route::post('/{id}', [PatentsController::class, 'update'])->middleware('auth:sanctum');
Route::get('/', [PatentsController::class, 'index'])->middleware('auth:sanctum');