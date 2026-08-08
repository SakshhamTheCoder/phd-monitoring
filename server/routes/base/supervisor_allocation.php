<?php

use App\Http\Controllers\SupervisorAllocationController;
use App\Models\IrbSupervisorApproval;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    Route::get('', [SupervisorAllocationController::class, 'listForm']);
    Route::post('', [SupervisorAllocationController::class, 'createForm']);
    Route::post('/bulk', [SupervisorAllocationController::class, 'bulkSubmit'])->name('form.bulk.create');
    Route::post('/bulk-allocate', [SupervisorAllocationController::class, 'bulkAllocate']);
    Route::get('/filters', [SupervisorAllocationController::class, 'listFilters']);
    Route::get('/{form_id}', [SupervisorAllocationController::class, 'loadForm'])->name('form.load');
    Route::post('/{form_id}', [SupervisorAllocationController::class, 'submit'])->name('form.submit');
});