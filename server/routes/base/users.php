<?php

use App\Http\Controllers\UserManagementController;
use Illuminate\Support\Facades\Route;

// Managing accounts is one gate, stated once here instead of as the first three
// lines of all seven methods. listFilters had no guard at all, so the users
// page's filter list was readable by any signed-in user; it is inside the gate
// now, which is what the page it serves already required.
Route::middleware(['auth:sanctum', 'can:can_manage_users'])->group(function () {
    Route::get('/', [UserManagementController::class, 'list']);
    Route::get('/filters', [UserManagementController::class, 'listFilters']);

    // Who cannot sign in yet, and mailing them the link when the office is
    // ready. An import deliberately mails nobody at the time it runs, and
    // each run stays pickable until its last person is in, so a second
    // import never buries the first. Declared before '/{id}' or the id
    // route swallows the path.
    Route::get('/sign-in-links', [UserManagementController::class, 'pendingSignInLinks']);
    Route::post('/sign-in-links', [UserManagementController::class, 'sendSignInLinks']);
    Route::post('/', [UserManagementController::class, 'createOrUpdate']);
    Route::get('/{id}', [UserManagementController::class, 'show']);
    Route::delete('/{id}', [UserManagementController::class, 'delete']);
    Route::post('/bulk-import', [UserManagementController::class, 'bulkImport']);
    Route::post('/{id}/reset-password', [UserManagementController::class, 'resetPassword']);
    Route::post('/{id}/send-reset-email', [UserManagementController::class, 'sendResetEmail']);
});
