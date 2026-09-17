<?php

use App\Http\Controllers\OutsideExpertController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    // The picker in the supervisor and doctoral committee manager reads this.
    Route::get('/all', [OutsideExpertController::class, 'all']);
});

// Managing the directory is the admin-only Outside Experts page. None of these
// carried a check, so any signed-in account could add, edit or delete experts.
Route::middleware(['auth:sanctum', 'can:can_manage_users'])->group(function () {
    Route::get('/list', [OutsideExpertController::class, 'list']);
    Route::get('/filters', [OutsideExpertController::class, 'listFilters']);
    Route::post('/add', [OutsideExpertController::class, 'add']);
    Route::post('/bulk-import', [OutsideExpertController::class, 'bulkImportFromCSV']);
    Route::put('/update/{id}', [OutsideExpertController::class, 'update']);
    Route::delete('/delete/{id}', [OutsideExpertController::class, 'delete']);
});
