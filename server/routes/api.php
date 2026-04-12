<?php

use App\Http\Controllers\EmailNotificationController;
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
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Helpers\CloudflareHelper;

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
        $ret['first_name'] = $user->first_name;
        $ret['last_name'] = $user->last_name;
        $ret['email'] = $user->email;
        $ret['phone'] = $user->phone;
        $ret['gender'] = $user->gender;
        $ret['role']['role'] = $user->current_role->role;
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
});

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
});

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
});

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
        } else {
            $user->current_role_id = $role->id;
            $user->save();
            $user->refresh();

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

Route::post('register', function (Request $request) {
    $request->validate([
        'first_name' => 'required|string',
        'last_name' => 'required|string',
        'phone' => 'required|string',
        'email' => 'required|email|unique:users',
        'password' => 'required|string',
        'gender' => 'required|string',
    ]);
    $user = new \App\Models\User();
    $user->first_name = $request->first_name;
    $user->last_name = $request->last_name;
    $user->phone = $request->phone;
    $user->email = $request->email;
    $user->password = bcrypt($request->password);
    $user->gender = $request->gender;
    $user->role_id = 1;
    $user->save();
    return response()->json($user, 200);
});

Route::post('create-role', function (Request $request) {
    $request->validate([
        'role' => 'required|string',
    ]);
    $role = new \App\Models\Role();
    $role->role = 'Default';
    $role->save();
    return response()->json($role, 200);
});
Route::prefix('roles')->group(function () {
    require base_path('routes/base/roles.php');
});
Route::get('/home', [HomeController::class, 'getHomeData'])->middleware('auth:sanctum');

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

Route::prefix('google')->group(function () {
    require base_path('routes/base/google_auth.php');
});

Route::get('/send-welcome', [EmailNotificationController::class, 'sendWelcomeEmail']);




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