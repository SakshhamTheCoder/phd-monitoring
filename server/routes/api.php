<?php

use App\Http\Controllers\PositionApplicationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use App\Models\Role;
use Illuminate\Support\Facades\App;
use App\Models\User;
use App\Models\Department;
use App\Models\Faculty;
use App\Models\Student;
use App\Http\Controllers\GoogleCalendarController;
use App\Http\Controllers\HomeController;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Helpers\CloudflareHelper;
use App\Models\FeatureFlag;

// Read by the client before it draws the nav, so a disabled module leaves no
// dead links behind. Public, because the landing page links to the openings.
Route::get('/features', fn() => response()->json(FeatureFlag::map()));

Route::post('/login', function (Request $request) {
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    // Verify captcha if provided (optional)
    if ($request->has('captcha_token') && $request->captcha_token) {
        if (!CloudflareHelper::verifyCaptcha($request->captcha_token)) {
            return response()->json([
                'error' => 'Captcha verification failed'
            ], 422);
        }
    }

    if (Auth::attempt($request->only('email', 'password'))) {
        /** @var \App\Models\MyUserModel $user **/
        $user = Auth::user();

        if ($user->isDeactivated()) {
            return response()->json(['error' => 'This account has been deactivated. Contact the office.'], 403);
        }

        if ($user->needsEmailConfirmation()) {
            return response()->json([
                'error' => "Confirm your email first. We sent a link to {$user->email}.",
                'unverified' => true,
                'email' => $user->email,
            ], 403);
        }

        if ($user->current_role_id == null) {
            if ($user->default_role_id == null) {
                $user->current_role_id = $user->role_id;
                $user->default_role_id = $user->role_id;
                $user->save();
            } else {
                $user->current_role_id = $user->default_role_id;
                $user->save();
            }
        }
        // The id lets the client tell its own rows from a teammate's.
        $ret['id'] = $user->id;
        $ret['first_name'] = $user->first_name;
        $ret['last_name'] = $user->last_name;
        $ret['email'] = $user->email;
        $ret['phone'] = $user->phone;
        $ret['gender'] = $user->gender;
        $ret['role']['role'] = $user->current_role->role;
        // False for a Google sign-up, which has a password nobody chose.
        $ret['password_set'] = $user->password_set_at !== null;
        $token = $user->createToken('auth_token', ['server:access'], now()->addDays(10))->plainTextToken;
        return response()->json([
            "user" => $ret,
            "available_roles" => $user->availableRoles(),
            "token" => $token
        ], 200);
    }
    return response()->json([
        'error' => 'Invalid Credentials'
    ], 401);
})->middleware('throttle:login');

// Clearing the client's storage alone leaves the token usable until it expires.
Route::post('/logout', function (Request $request) {
    $request->user()->currentAccessToken()->delete();
    return response()->json(['message' => 'Signed out.']);
})->middleware('auth:sanctum');

Route::post('/forgot-password', function (Request $request) {
    $validator = Validator::make($request->all(), [
        'email' => 'required|email|exists:users,email',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'success' => false,
            'errors' => $validator->errors(),
        ], 422);
    }

    // Verify captcha if provided (optional)
    if ($request->has('captcha_token') && $request->captcha_token) {
        if (!CloudflareHelper::verifyCaptcha($request->captcha_token)) {
            return response()->json([
                'success' => false,
                'error' => 'Captcha verification failed'
            ], 422);
        }
    }

    $status = Password::sendResetLink(
        $request->only('email')
    );

    if ($status === Password::RESET_LINK_SENT) {
        return response()->json([
            'success' => true,
            'message' => __($status),
        ], 200);
    }

    return response()->json([
        'success' => false,
        'error' => __($status),
    ], 500);
})->middleware('throttle:auth-email');

/**
 * Asks for the current password, except where there is none to give: a Google
 * sign-up holds one nobody was told, and being signed in is the proof.
 */
Route::post('/change-password', function (Request $request) {
    /** @var \App\Models\User $user */
    $user = $request->user();
    $chosenBefore = $user->password_set_at !== null;

    $request->validate([
        'password' => ['required', 'min:8', 'confirmed'],
    ]);

    // Not the current_password rule: it reads the default guard, and this
    // request is authenticated by a token.
    if ($chosenBefore && !Hash::check((string) $request->current_password, $user->password)) {
        throw ValidationException::withMessages([
            'current_password' => 'That is not your current password.',
        ]);
    }

    if (Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'password' => 'Your new password has to be different from the old one.',
        ]);
    }

    $user->forceFill([
        'password' => Hash::make($request->password),
        'password_set_at' => now(),
        'first_activation' => $user->first_activation ?? now(),
    ])->save();

    // Signing out elsewhere is what makes a changed password mean anything.
    $user->tokens()->where('id', '!=', optional($user->currentAccessToken())->id)->delete();

    return response()->json(['message' => 'Your password is changed.']);
})->middleware('auth:sanctum');

Route::post('/reset-password', function (Request $request) {
    $validator = Validator::make($request->all(), [
        'token' => 'required|string',
        'email' => 'required|email|exists:users,email',
        'password' => 'required|min:8|confirmed',
    ]);

    if ($validator->fails()) {
        return response()->json([
            'errors' => $validator->errors(),
        ], 422);
    }

    $status = Password::reset(
        $request->only('email', 'password', 'password_confirmation', 'token'),
        function (User $user, string $password) {
            $user->forceFill([
                'password' => Hash::make($password),
                'password_set_at' => now(),
                'remember_token' => Str::random(60),
            ])->save();

            // Mark first activation as complete if this is their first time setting password
            if ($user->first_activation === null) {
                $user->first_activation = now();
                $user->save();
            }
        }
    );

    if ($status === Password::PASSWORD_RESET) {
        return response()->json([
            'success' => true,
            'message' => __($status)
        ], 200);
    }

    return response()->json([
        'success' => false,
        'error' => __($status)
    ], 500);
})->middleware('throttle:auth-email');

// available_roles otherwise reaches the client only at login, so a role granted
// mid-session stays invisible until the user logs out and back in.
// Who the user is acting as, what that role may do, and the menus and page
// access to draw for it (App\Support\Navigation). /me is the same answer; the
// web reads it for its routes and sidebar, and the app for its own.
$me = fn () => response()->json(\App\Support\Navigation::me(Auth::user()));
Route::get('/my-roles', $me)->middleware('auth:sanctum');
Route::get('/me', $me)->middleware('auth:sanctum');

// A page described for the reader: header, table, dialogs and imports
// (App\Pages). The web and the app draw it from this rather than each keeping
// its own copy.
// Every list the reader may open without route parameters, at once.
Route::get('/views', fn () => response()->json(['views' => \App\Pages\Pages::prefetched(Auth::user())]))->middleware('auth:sanctum');

Route::get('/views/{page}', function (string $page) {
    $definition = \App\Pages\Pages::find($page);
    abort_if($definition === null, 404);
    abort_unless($definition->allows(Auth::user()), 403);

    // A page opened on a route with parameters (a form type, a scholar) is told them.
    return response()->json($definition->view(Auth::user(), request()->query()));
})->middleware('auth:sanctum');

Route::post('/switch-role', function (Request $request) {
    try {
        $request->validate([
            'role' => 'required|string',
        ]);
        /** @var \App\Models\MyUserModel $user **/
        $user = Auth::user();
        $role = Role::where('role', $request->role)->first();
        if (!$role) {
            return response()->json([
                'error' => 'Role not found'
            ], 404);
        }
        if (!$user) {
            return response()->json([
                'error' => 'User not found'
            ], 404);
        }
        $allowed = $user->isAuthorized($role->role);
        if (!$allowed) {
            return response()->json([
                'error' => 'Unauthorized'
            ], 401);
        }

        // Being granted a role is not the same as having the data it depends on.
        // Roles are deliberately assigned before their linkage exists during
        // provisioning, so this is the boundary where it has to hold: you may
        // hold the role, but you cannot act as it until the record backing it
        // exists. Without this, switching succeeded and every subsequent action
        // failed with an opaque 403 (or a 500 on a missing faculty record).
        // Gated by roles.enforce_backing, which is off by default, so existing
        // accounts keep switching as before until an audit has been run against
        // the real database. See config/roles.php.
        $unmet = \App\Support\RoleRequirements::unmet($user, $role->role);
        if ($unmet !== null) {
            \Illuminate\Support\Facades\Log::warning('Role switch into a role with no backing record', [
                'user_id' => $user->id,
                'role' => $role->role,
                'problem' => $unmet,
                'enforced' => (bool) config('roles.enforce_backing'),
            ]);

            if (config('roles.enforce_backing')) {
                return response()->json([
                    'error' => "You cannot switch to this role because your account {$unmet}.",
                ], 403);
            }
        } {
            $user->current_role_id = $role->id;
            $user->save();
            $user->refresh();

            $ret['id'] = $user->id;
            $ret['first_name'] = $user->first_name;
            $ret['last_name'] = $user->last_name;
            $ret['email'] = $user->email;
            $ret['phone'] = $user->phone;
            $ret['gender'] = $user->gender;
            $ret['role']['role'] = $role->role;
            return response()->json([
                "user" => $ret,
            ], 200);
        }
    } catch (\Exception $e) {
        return response()->json([
            'error' => 'Invalid Request'
        ], 401);
    }
})->middleware('auth:sanctum');

Route::prefix('roles')->group(function () {
    require base_path('routes/base/roles.php');
});
Route::get('/home', [HomeController::class, 'getHomeData'])->middleware('auth:sanctum');
// Stored uploads, for whoever may read the record they belong to.
Route::get('/files', [\App\Http\Controllers\FileController::class, 'show'])->middleware('auth:sanctum');

Route::prefix('notifications')->group(function () {
    require base_path('routes/base/notifications.php');
});

Route::prefix('departments')->group(function () {
    require base_path('routes/base/departments.php');
});


Route::prefix('publications')->group(function () {
    require base_path('routes/base/publications.php');
});

Route::prefix('patents')->group(function () {
    require base_path('routes/base/patents.php');
});

// Project management (create/manage projects, milestones, documents) lives
// behind its own switch so it can stay up while job openings are off.
Route::middleware('feature:project_management')->group(function () {
    Route::prefix('projects')->group(function () {
        require base_path('routes/base/projects.php');
    });
});

// Job openings, applications and the student-facing board. See FeatureFlag.
Route::middleware('feature:job_openings')->group(function () {
    Route::prefix('applications')->group(function () {
        require base_path('routes/base/applications.php');
    });

    Route::prefix('openings')->group(function () {
        require base_path('routes/base/openings.php');
    });

    Route::get('/my-applications', [PositionApplicationController::class, 'myApplications'])->middleware('auth:sanctum');
});

Route::prefix('faculty')->group(function () {
    require base_path('routes/base/faculties.php');
});

Route::prefix('students')->group(function () {
    require base_path('routes/base/students.php');
});

Route::prefix('supervisors')->group(function () {
    require base_path('routes/base/supervisors.php');
});

Route::prefix('forms')->group(function () {
    require base_path('routes/base/forms.php');
});


Route::prefix('presentation')->group(function () {
    require base_path('routes/base/presentation.php');
});

Route::prefix('suggestions')->group(function () {
    require base_path('routes/base/suggestions.php');
});

Route::prefix('semester')->group(function () {
    require base_path('routes/base/semester.php');
});

Route::prefix('approval')->group(function () {
    require base_path('routes/base/approvals.php');
});

// Openings as an outsider sees them: browse, apply, then track by token.
Route::middleware('feature:job_openings')->group(function () {
    Route::prefix('public/openings')->group(function () {
        Route::get('/', [\App\Http\Controllers\PublicOpeningController::class, 'index']);
        Route::get('/{id}', [\App\Http\Controllers\PublicOpeningController::class, 'show']);
        Route::get('/{id}/advertisement', [\App\Http\Controllers\PublicOpeningController::class, 'advertisement']);
        Route::post('/{id}/apply', [\App\Http\Controllers\PublicOpeningController::class, 'apply'])
            ->middleware('throttle:5,60,opening-apply');
    });
    Route::prefix('public/applications')->group(function () {
        // An applicant may refresh this a handful of times while waiting on a decision.
        Route::get('/{token}', [\App\Http\Controllers\PublicOpeningController::class, 'status'])
            ->middleware('throttle:30,60,application-status');
        Route::post('/{token}/verify', [\App\Http\Controllers\PublicOpeningController::class, 'verify'])
            ->middleware('throttle:10,60,application-verify');
    });
});

// Secure external-expert review (public, token-authenticated, the token is the credential).
// Each throttle names its own counter: unnamed ones share one per IP, so a
// reviewer's page and PDF loads used up the five submits before they were made.
Route::prefix('external-review')->group(function () {
    // A reviewer reloads the page and re-fetches the PDF repeatedly while reading it.
    Route::get('/{token}', [\App\Http\Controllers\ExternalReviewController::class, 'show'])
        ->middleware('throttle:60,60,external-review-show');
    Route::get('/{token}/pdf', [\App\Http\Controllers\ExternalReviewController::class, 'pdf'])
        ->middleware('throttle:60,60,external-review-pdf');
    // The decision is submitted once, so this stays as tight as the sibling /apply route.
    Route::post('/{token}', [\App\Http\Controllers\ExternalReviewController::class, 'submit'])
        ->middleware('throttle:5,60,external-review-submit');
});
Route::post('irb-submissions/{id}/resend-external-review', [\App\Http\Controllers\ExternalReviewController::class, 'resend'])
    ->middleware('auth:sanctum');
Route::prefix('admin')->group(function () {
    require base_path('routes/base/admin.php');
});

Route::prefix('courses')->group(function () {
    require base_path('routes/base/courses.php');
});

Route::prefix('outside-experts')->group(function () {
    require base_path('routes/base/outside_experts.php');
});

Route::prefix('supervisor-doctoral-changes')->group(function () {
    require base_path('routes/base/supervisor_doctoral_changes.php');
});

Route::prefix('users')->group(function () {
    require base_path('routes/base/users.php');
});

Route::prefix('urf')->group(function () {
    require base_path('routes/base/urf.php');
});

Route::prefix('ug-students')->group(function () {
    require base_path('routes/base/ug_students.php');
});

Route::prefix('ug-branches')->group(function () {
    require base_path('routes/base/ug_branches.php');
});

Route::prefix('synopsis-checklist')->group(function () {
    require base_path('routes/base/synopsis_checklist.php');
});

Route::prefix('settings')->group(function () {
    require base_path('routes/base/settings.php');
});

Route::prefix('clerks')->group(function () {
    require base_path('routes/base/clerks.php');
});

Route::prefix('google')->group(function () {
    require base_path('routes/base/google_auth.php');
});





// Route::post('/schedule-reminder', [, 'scheduleReminder']);
// Route::get('/init',function (){

//     User::factory()->count(10)->create();
//     Department::factory()->count(3)->create();
//     Role::factory()->count(5)->create();
//     Student::factory()->count(15)->create();
//     Faculty::factory()->count(8)->create();


// return response()->json([
//     'message' => 'Data initialized successfully'
// ], 200);
// });