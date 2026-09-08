<?php

use App\Http\Controllers\UserController;
use Illuminate\Support\Facades\Route;

Route::get('/', [UserController::class,'listForms'])->middleware('auth:sanctum');

Route::prefix('irb-constitution')->group(function () {
    require base_path('routes/base/irb/irbc_form.php');
});

Route::prefix(('presentation'))->group(function () {
    require base_path('routes/base/presentation.php');
});

Route::prefix('irb-submission')->group(function () {
    require base_path('routes/base/irb/irbs_form.php');
});

Route::prefix('thesis-submission')->group(function () {
    require base_path('routes/base/thesis_submission.php');
});

Route::prefix('thesis-extension')->group(function () {
    require base_path('routes/base/thesis_extention.php');
});

Route::prefix('irb-extension')->group(function () {
    require base_path('routes/base/research_extention.php');
});

Route::prefix('supervisor-change')->group(function () {
    require base_path('routes/base/supervisor_change.php');
});

Route::prefix('supervisor-allocation')->group(function () {
    require base_path('routes/base/supervisor_allocation.php');
});

Route::prefix('status-change')->group(function () {
    require base_path('routes/base/student_status_change.php');
});
Route::prefix('synopsis-submission')->group(function () {
    require base_path('routes/base/synopsis_submission.php');
});
Route::prefix('revise-title')->group(function () {
    require base_path('routes/base/synopsis_submission.php');
});
Route::prefix('semester-off')->group(function () {
    require base_path('routes/base/semester_off.php');
});

Route::prefix('list-of-examiners')->group(function () {
    require base_path('routes/base/list-of-examiners.php');
});

Route::prefix('student-leave')->group(function () {
    require base_path('routes/base/student_leave.php');
});

