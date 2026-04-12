<?php

use App\Http\Controllers\PatentsController;
use Illuminate\Support\Facades\Route;



// Route::post('/', [PatentsController::class, 'load'])->middleware('auth:sanctum');
Route::post('/', [PatentsController::class , 'store'])->middleware('auth:sanctum');
Route::put('/{id}', [PatentsController::class , 'update'])->middleware('auth:sanctum');
// Route::put('/', [PatentsController::class, 'update'])->middleware('auth:sanctum');
// Route::post('/submit', [PatentsController::class, 'submit'])->middleware('auth:sanctum');