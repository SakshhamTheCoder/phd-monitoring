<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PresentationController;
use App\Http\Controllers\SemesterController;

Route::middleware('auth:sanctum')->group(function () {
    //get semesters

    Route::get('/',[PresentationController::class, 'listSemesterPresentation']);
    Route::post('/', [PresentationController::class, 'createForm']);
    
    Route::get('/semester', [PresentationController::class, 'listSemesterPresentation']);

    // Progress history from the institute's sheet, loaded once per scholar
    // per past semester. The bulk schedule above is for the current one.
    Route::post('/import-progress', [PresentationController::class, 'importProgress']);

    // Filters
    Route::get('/filters', [PresentationController::class, 'listFilters']);
    Route::get('/form/filters', [PresentationController::class, 'listFilters']);
    
    // Bulk Scheduling

    Route::get('/semester/{semester_id}', [PresentationController::class, 'listForm']);
    Route::post('/semester/{semester_id}', [PresentationController::class, 'createForm']);
    Route::post('/semester/{semester_id}/bulk-schedule', [PresentationController::class, 'createMultipleForm']);
    Route::get('/semester/{semester_id}/filters', [PresentationController::class, 'listFilters']);
    Route::get('/semester/{semester_id}/not-scheduled', [SemesterController::class, 'notScheduled'])->middleware('auth:sanctum');
 
    Route::post('/semester/{semester_id}/bulk', [PresentationController::class, 'bulkSubmit']);

    // Form with ID (view, submit, link/unlink)
    Route::get('/semester/{semester_id}/{form_id}', [PresentationController::class, 'loadForm']);
    Route::post('/semester/{semester_id}/{form_id}', [PresentationController::class, 'submit']);
    Route::post('/semester/{semester_id}/{form_id}/link', [PresentationController::class, 'linkPublication']);
    Route::post('/semester/{semester_id}/{form_id}/unlink', [PresentationController::class, 'unlinkPublication']);

    // Bulk form submission

    // Semester-based form listing
});
