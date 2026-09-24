<?php

use App\Http\Controllers\CourseController;
use App\Http\Controllers\StudentCourseController;
use Illuminate\Support\Facades\Route;

Route::middleware('auth:sanctum')->group(function () {
    // Course management (Admin/HOD/Coordinator), who alone may read the list.
    Route::get('/list', [CourseController::class, 'list'])->middleware('area:courseManagement');
    Route::get('/filters', [CourseController::class, 'listFilters'])->middleware('area:courseManagement');
    Route::post('/add', [CourseController::class, 'add']);
    Route::put('/update/{id}', [CourseController::class, 'update']);
    Route::delete('/delete/{id}', [CourseController::class, 'delete']);
    Route::get('/all', [CourseController::class, 'getAllCourses']);
    Route::post('/import', [CourseController::class, 'importCoursesFromCSV']);

    // Student-Course management
    Route::prefix('student')->group(function () {
        Route::get('/my-courses', [StudentCourseController::class, 'getStudentCourses']);
        Route::post('/tag', [StudentCourseController::class, 'tagStudentWithCourse']);
        Route::post('/bulk-import', [StudentCourseController::class, 'bulkImportFromCSV']);
        Route::put('/grade/{id}', [StudentCourseController::class, 'updateGrade']);
        Route::get('/courses/{studentId}', [StudentCourseController::class, 'getCoursesForStudent']);
        Route::delete('/remove/{id}', [StudentCourseController::class, 'removeStudentFromCourse']);
    });
});
