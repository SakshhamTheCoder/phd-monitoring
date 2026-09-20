<?php

use App\Http\Controllers\UgSignupController;
use App\Http\Controllers\UgStudentController;
use App\Http\Controllers\UrfController;
use App\Http\Controllers\UrfDecisionController;
use Illuminate\Support\Facades\Route;

// Sign-up and the branch list it offers: nobody is logged in yet. Everything
// below needs a session.
Route::get('/branches', [UrfController::class, 'branches']);
Route::post('/signup', [UgSignupController::class, 'signup'])->middleware('throttle:10,1');
Route::get('/verify-email/{id}', [UgSignupController::class, 'verify'])->name('urf.verify-email')->middleware('signed');
Route::post('/resend-verification', [UgSignupController::class, 'resend'])->middleware('throttle:6,1');

// Undergraduate Research Fellowship. The controller checks who may do what.
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/', [UrfController::class, 'list']);
    Route::post('/', [UrfController::class, 'apply']);
    Route::get('/filters', [UrfController::class, 'listFilters']);
    // Projects awarded before the portal existed, from the office's sheet.
    Route::post('/import-awarded', [UrfController::class, 'importAwarded']);
    Route::get('/mine', [UrfController::class, 'mine']);
    Route::patch('/me', [UgStudentController::class, 'updateMine']);
    Route::get('/sessions', [UrfController::class, 'sessions']);
    Route::get('/report-windows', [UrfController::class, 'reportWindows']);
    Route::post('/report-windows', [UrfController::class, 'saveReportWindow']);
    Route::delete('/report-windows/{id}', [UrfController::class, 'deleteReportWindow'])->whereNumber('id');
    $forms = ['urf-application', 'urf-additional-info', 'urf-half-yearly-report', 'urf-final-report'];
    Route::get('/queue', [UrfDecisionController::class, 'queue']);
    Route::post('/{form}/{id}/decision', [UrfDecisionController::class, 'decide'])
        ->whereIn('form', $forms)->whereNumber('id');
    // One form of one project, the page that shows what was filled and what
    // each step said. Ahead of /{id} so a form name is never read as an id.
    Route::get('/{form}/{id}', [UrfController::class, 'formShow'])
        ->whereIn('form', $forms)->whereNumber('id');
    Route::get('/{form}', [UrfController::class, 'formList'])->whereIn('form', $forms);
    Route::get('/{form}/filters', [UrfController::class, 'listFilters'])->whereIn('form', $forms);
    Route::get('/{id}', [UrfController::class, 'show'])->whereNumber('id');
    Route::post('/{id}/status', [UrfController::class, 'setStatus'])->whereNumber('id');
    Route::post('/{id}/fellow', [UrfController::class, 'saveFellow'])->whereNumber('id');
    Route::post('/{id}/reports', [UrfController::class, 'addReport'])->whereNumber('id');
});
