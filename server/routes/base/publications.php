<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\PublicationController;
use Illuminate\Support\Facades\Auth;


Route::post('/', [PublicationController::class, 'store'])->middleware('auth:sanctum');
Route::post('/{id}', [PublicationController::class, 'update'])->middleware('auth:sanctum');
Route::get('/', [PublicationController::class, 'get'])->middleware('auth:sanctum');
