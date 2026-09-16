<?php

use App\Http\Controllers\UgSignupController;
use App\Http\Controllers\UgStudentController;
use App\Http\Controllers\UrfController;
use App\Http\Controllers\UrfDecisionController;
use Illuminate\Support\Facades\Route;

// Signing up is how a UG student gets an account, so nobody is logged in yet.
// The branch list is out here with it, since the sign-up form offers it.
// Everything after these needs a session.
Route::get('/branches', [UrfController::class, 'branches']);
Route::post('/signup', [UgSignupController::class, 'signup'])->middleware('throttle:10,1');
Route::get('/verify-email/{id}', [UgSignupController::class, 'verify'])->name('urf.verify-email')->middleware('signed');
Route::post('/resend-verification', [UgSignupController::class, 'resend'])->middleware('throttle:6,1');

// Undergraduate Research Fellowship. The controller checks who may do what.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UrfController::class, 'list']);
    Route::post('/', [UrfController::class, 'apply']);
    Route::get('/filters', [UrfController::class, 'listFilters']);
    Route::get('/mine', [UrfController::class, 'mine']);
    Route::patch('/me', [UgStudentController::class, 'updateMine']);
    Route::get('/sessions', [UrfController::class, 'sessions']);
    // The forms grid: one list per form, with the shared filter bar.
    $forms = ['urf-application', 'urf-additional-info', 'urf-half-yearly-report', 'urf-final-report'];
    // What is waiting on whoever is asking, and what they decide about it.
    Route::get('/queue', [UrfDecisionController::class, 'queue']);
    Route::post('/{form}/{id}/decision', [UrfDecisionController::class, 'decide'])
        ->whereIn('form', $forms)->whereNumber('id');
    Route::get('/{form}', [UrfController::class, 'formList'])->whereIn('form', $forms);
    Route::get('/{form}/filters', [UrfController::class, 'listFilters'])->whereIn('form', $forms);
    Route::get('/{id}', [UrfController::class, 'show'])->whereNumber('id');
    Route::post('/{id}/status', [UrfController::class, 'setStatus'])->whereNumber('id');
    Route::post('/{id}/fellow', [UrfController::class, 'saveFellow'])->whereNumber('id');
    Route::post('/{id}/reports', [UrfController::class, 'addReport'])->whereNumber('id');
});
