<?php
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectWizardController;
use App\Http\Controllers\ProjectMilestoneController;
use App\Http\Controllers\ProjectDocumentController;
use App\Http\Controllers\ProjectPositionController;
use App\Http\Controllers\PositionApplicationController;
use Illuminate\Support\Facades\Route;

Route::get('/stats', [ProjectController::class, 'stats'])->middleware('auth:sanctum');
Route::get('/meta', [ProjectController::class, 'meta'])->middleware('auth:sanctum');
Route::get('/filters', [ProjectController::class, 'listFilters'])->middleware('auth:sanctum');
// The overview's figures and rows, each value phrased (App\Pages\ProjectsPage).
Route::get('/overview', fn (\Illuminate\Http\Request $request) => response()->json(\App\Pages\ProjectsPage::overview($request)))->middleware('auth:sanctum');
// The wizard reviews and saves a whole proposal in one request; before /{id}.
Route::post('/wizard/review', [ProjectWizardController::class, 'review'])->middleware('auth:sanctum');
Route::post('/wizard', [ProjectWizardController::class, 'store'])->middleware('auth:sanctum');
Route::post('/wizard/{id}', [ProjectWizardController::class, 'update'])->middleware('auth:sanctum');
Route::get('/', [ProjectController::class, 'index'])->middleware('auth:sanctum');
Route::post('/', [ProjectController::class, 'store'])->middleware('auth:sanctum');
Route::get('/{id}', [ProjectController::class, 'show'])->middleware('auth:sanctum');
Route::post('/{id}', [ProjectController::class, 'update'])->middleware('auth:sanctum');
Route::delete('/{id}', [ProjectController::class, 'destroy'])->middleware('auth:sanctum');
Route::post('/{id}/milestones', [ProjectMilestoneController::class, 'store'])->middleware('auth:sanctum');
Route::post('/{id}/milestones/{milestoneId}', [ProjectMilestoneController::class, 'update'])->middleware('auth:sanctum');
Route::delete('/{id}/milestones/{milestoneId}', [ProjectMilestoneController::class, 'destroy'])->middleware('auth:sanctum');
Route::post('/{id}/documents', [ProjectDocumentController::class, 'store'])->middleware('auth:sanctum');
Route::post('/{id}/documents/{documentId}', [ProjectDocumentController::class, 'update'])->middleware('auth:sanctum');
Route::delete('/{id}/documents/{documentId}', [ProjectDocumentController::class, 'destroy'])->middleware('auth:sanctum');
// Recruitment. These hang off a project, but what they produce is an opening
// and the applicants for it, so they answer to the job_openings switch rather
// than to project_management. With openings off, a PI could still post a
// position and list its applicants while POST /applications/{id}/status, which
// was already behind that switch, refused every decision on them.
Route::middleware('feature:job_openings')->group(function () {
    Route::get('/{id}/positions', [ProjectPositionController::class, 'index'])->middleware('auth:sanctum');
    Route::post('/{id}/positions', [ProjectPositionController::class, 'store'])->middleware('auth:sanctum');
    Route::post('/{id}/positions/{positionId}', [ProjectPositionController::class, 'update'])->middleware('auth:sanctum');
    Route::delete('/{id}/positions/{positionId}', [ProjectPositionController::class, 'destroy'])->middleware('auth:sanctum');
    Route::get('/{id}/applications', [PositionApplicationController::class, 'index'])->middleware('auth:sanctum');
});
