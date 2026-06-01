<?php

use App\Http\Controllers\LogViewerController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\SupervisorController;
use App\Http\Controllers\AdminFormController;
use App\Jobs\ProcessBulkForgotPassword;
use Illuminate\Support\Facades\Password;
use App\Models\User;
use App\Notifications\WelcomeResetPassword;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;


Route::middleware('auth:sanctum')->group(function () {
    Route::post('/allot-supervisor', [SupervisorController::class, 'assign']);
    Route::post('/allot-doctoral', [SupervisorController::class, 'assignDoctoral']);

    // Admin Form Management Routes
    Route::get('/forms/student/{student_id}', [AdminFormController::class, 'getStudentForms']);
    Route::post('/forms/create', [AdminFormController::class, 'createFormInstance']);
    Route::post('/forms/update-control', [AdminFormController::class, 'updateFormControl']);
    Route::post('/forms/toggle-availability', [AdminFormController::class, 'toggleFormAvailability']);
    Route::post('/forms/update-stage', [AdminFormController::class, 'updateGeneralFormStage']);
    Route::post('/forms/disable', [AdminFormController::class, 'disableForm']);
    Route::delete('/forms/delete', [AdminFormController::class, 'deleteFormInstance']);


    Route::post('/bulk-forgot-password', function (Request $request) {
        $emails = $request->input('emails', []);

        Log::info('Queued bulk reset for: ', $emails);

        ProcessBulkForgotPassword::dispatch($emails); // Dispatching to queue

        return response()->json([
            'status' => 'success',
            'message' => 'Reset links are being processed in the background.'
        ]);
    });
    Route::get('/logs', [LogViewerController::class, 'fetchLogs']);

    Route::get('/research-profile', function (Request $request) {
        return response()->json([
            'success' => true,
            'profile' => [
                'name' => 'Manjot Kaur',
                'designation' => 'Senior Researcher',
                'department' => 'Department of Computer Science',
                'joined' => 'August 12, 2015',
                'total_publications' => 142,
                'citations' => '4.8k',
                'email' => 'mkaur@thapar.edu',
                'phone' => '+91 9876543210',
                'linkedin' => 'https://www.linkedin.com/in/kaurmanjot',
                'orcid_id' => '0000-0002-1825-0097',
                'scopus_id' => '57194012300',
                'google_scholar_id' => 'eYHa9_sAAAAJ',
                'approved' => 120,
                'pending' => 15,
                'rejected' => 7,
                'last_sync' => 'Oct 20, 2025 10:30 AM'
            ],
            'publications' => [
                'sci' => [
                    [
                        'id' => 1,
                        'authors' => 'Manjot Kaur',
                        'title' => 'Quantum Computing Implementations in Secure Systems',
                        'name' => 'Journal of Applied Physics',
                        'year' => '2023',
                        'status' => 'APPROVED',
                        'impact_factor' => 9.2,
                        'doi_link' => 'https://doi.org/10.quant/1'
                    ],
                    [
                        'id' => 2,
                        'authors' => 'A. Smith, Manjot Kaur',
                        'title' => 'Machine Learning for Traffic Prediction',
                        'name' => 'IEEE Transactions on ITS',
                        'year' => '2020',
                        'status' => 'REJECTED',
                        'impact_factor' => 4.5,
                        'doi_link' => 'https://doi.org/10.ieee/2'
                    ],
                    [
                        'id' => 3,
                        'authors' => 'Manjot Kaur',
                        'title' => 'Sustainable Energy and AI',
                        'name' => 'Energy Journal',
                        'year' => '2024',
                        'status' => 'PENDING',
                        'impact_factor' => 6.1,
                        'doi_link' => 'https://doi.org/10.energy/3'
                    ]
                ],
                'non_sci' => [
                    [
                        'id' => 4,
                        'authors' => 'C. Johnson, Manjot Kaur',
                        'title' => 'Optimizing Database Queries',
                        'name' => 'Scopus Analytics Review',
                        'year' => '2022',
                        'status' => 'APPROVED',
                        'impact_factor' => 2.3,
                        'publisher' => 'Elsevier'
                    ],
                    [
                        'id' => 5,
                        'authors' => 'Manjot Kaur, M. Patel',
                        'title' => 'A Novel Approach to IoT Security',
                        'name' => 'International Network Journal',
                        'year' => '2019',
                        'status' => 'REJECTED',
                        'impact_factor' => 1.8,
                        'publisher' => 'Springer'
                    ]
                ],
                'international' => [
                    [
                        'id' => 7,
                        'authors' => 'Manjot Kaur, B. Wayne',
                        'title' => 'Cloud Migration Strategies in Enterprise',
                        'name' => 'International Cloud Summit',
                        'year' => '2024',
                        'status' => 'PENDING',
                        'country' => 'London, UK',
                        'doi_link' => 'https://doi.org/10.cloud/6'
                    ],
                    [
                        'id' => 71,
                        'authors' => 'W. Clark, Manjot Kaur',
                        'title' => 'Advances in Parallel Processing',
                        'name' => 'Global IEEE Symposium',
                        'year' => '2021',
                        'status' => 'APPROVED',
                        'country' => 'Tokyo, Japan',
                        'doi_link' => 'https://doi.org/10.parallel/7'
                    ]
                ],
                'national' => [
                    [
                        'id' => 8,
                        'authors' => 'Manjot Kaur, D. R.',
                        'title' => 'Regional Agriculture Optimization',
                        'name' => 'National Agritech Conference',
                        'year' => '2018',
                        'status' => 'APPROVED',
                        'city' => 'Pune, India',
                        'doi_link' => 'https://doi.org/10.agri/8'
                    ],
                    [
                        'id' => 81,
                        'authors' => 'Manjot Kaur',
                        'title' => 'Smart City Implementations in Punjab',
                        'name' => 'Indian Smart Cities Conclave',
                        'year' => '2023',
                        'status' => 'PENDING',
                        'city' => 'Chandigarh, India',
                        'doi_link' => 'https://doi.org/10.smart/9'
                    ]
                ],
                'book' => [
                    [
                        'id' => 6,
                        'authors' => 'Manjot Kaur',
                        'name' => 'Deep Learning Foundations',
                        'title' => 'Introduction to Neural Networks',
                        'year' => '2020',
                        'status' => 'APPROVED',
                        'publisher' => 'Oxford University Press'
                    ],
                    [
                        'id' => 61,
                        'authors' => 'J. Doe, Manjot Kaur',
                        'name' => 'Modern Web Architectures',
                        'title' => 'Micro-frontends in Practice',
                        'year' => '2024',
                        'status' => 'PENDING',
                        'publisher' => 'O\'Reilly Media'
                    ]
                ],
                'patents' => [
                    [
                        'id' => 9,
                        'authors' => 'Dr. Manjot Kaur, P. Parker',
                        'title' => 'Automated Threat Detection System',
                        'year' => '2023',
                        'status' => 'GRANTED',
                        'country' => 'International'
                    ],
                    [
                        'id' => 10,
                        'authors' => 'Dr. Manjot Kaur',
                        'title' => 'High Efficiency Cryptographic Hashing Method',
                        'year' => '2021',
                        'status' => 'PENDING',
                        'country' => 'National'
                    ]
                ]
            ]
        ]);
    });
});
