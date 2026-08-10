<?php
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use App\Http\Controllers\FacultyController;
use App\Http\Controllers\FacultyProfileController;
use Illuminate\Support\Facades\Auth;

Route::get('',[FacultyController::class, 'list'])->middleware('auth:sanctum');
Route::get('/me', [FacultyController::class, 'me'])->middleware('auth:sanctum');

Route::post('/add', [FacultyController::class, 'add'])->middleware('auth:sanctum');
Route::put('/update/{id}', [FacultyController::class, 'update'])->middleware('auth:sanctum');
Route::post('/bulk-import', [FacultyController::class, 'upload'])->middleware('auth:sanctum');
Route::get('/upload-faculty', [FacultyController::class, 'showUploadForm'])->name('faculty.upload.form');
Route::post('/upload-faculty', [FacultyController::class, 'upload'])->name('faculty.upload');
Route::get('/filters', [FacultyController::class, 'listFilters']);

// The research profile and its publications sit behind a switch. The faculty
// directory above does not, because it predates the module. See FeatureFlag.
Route::middleware(['auth:sanctum', 'feature:research_profile'])->group(function () {
    Route::get('/{facultyCode}/profile', [FacultyProfileController::class, 'show']);
    Route::post('/{facultyCode}/profile', [FacultyProfileController::class, 'update']);
    Route::post('/{facultyCode}/profile/sync', [FacultyProfileController::class, 'sync']);
    Route::post('/{facultyCode}/publications', [FacultyProfileController::class, 'storePublication']);
    Route::post('/{facultyCode}/publications/{publicationId}', [FacultyProfileController::class, 'updatePublication']);
    Route::delete('/{facultyCode}/publications/{publicationId}', [FacultyProfileController::class, 'destroyPublication']);
});
