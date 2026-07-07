<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SuggestionController;


Route::middleware('auth:sanctum')->group(function () {
    Route::post('specialization',[SuggestionController::class, 'suggestSpecialization']);
    Route::post('subdomain',[SuggestionController::class, 'suggestSubdomain']);
    Route::post('faculty', [SuggestionController::class, 'suggestFaculty']);
    Route::post('outside-expert', [SuggestionController::class, 'suggestOutsideExpert']);
    Route::post('department', [SuggestionController::class, 'suggestDepartment']);
    Route::post('examiner', [SuggestionController::class, 'suggestExaminer']);
    Route::post('country', [SuggestionController::class, 'suggestCountry']);
    Route::post('state', [SuggestionController::class, 'suggestState']);
    Route::post('city', [SuggestionController::class, 'suggestCity']);
    Route::post('designation', [SuggestionController::class, 'suggestDesignation']);
});
