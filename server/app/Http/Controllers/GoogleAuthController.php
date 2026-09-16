<?php

namespace App\Http\Controllers;

use App\Models\UgStudent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Facades\Socialite;
use Illuminate\Support\Str;

class GoogleAuthController extends Controller
{
    /**
     * Redirect to Google OAuth
     */
    public function redirectToGoogle()
    {
        return Socialite::driver('google')
            ->stateless()
            ->redirect();
    }

    /**
     * Handle Google OAuth callback
     */
    public function handleGoogleCallback(Request $request)
    {
        try {
            // Get user info from Google
            $googleUser = Socialite::driver('google')
                ->stateless()
                ->user();

            // Check if user exists by email
            $user = User::where('email', $googleUser->getEmail())->first();

            if (!$user) {
                // An undergraduate address with no account came here to sign up.
                if (UgStudent::eligibleEmail($googleUser->getEmail())) {
                    return redirect(env('FRONTEND_URL', 'https://phdportal.thapar.edu') . '/google/callback?' . http_build_query([
                        'signup' => UgSignupController::issueGoogleTicket($googleUser->getEmail(), $googleUser->getName()),
                        'email' => $googleUser->getEmail(),
                        'name' => $googleUser->getName(),
                    ]));
                }

                // User does not exist, redirect with error
                return redirect(env('FRONTEND_URL', 'https://phdportal.thapar.edu') . '/google/callback?error=' . urlencode('No account found with this email. Please contact administrator.'));
            }

            if ($user->isDeactivated()) {
                return redirect(env('FRONTEND_URL', 'https://phdportal.thapar.edu') . '/google/callback?error=' . urlencode('This account has been deactivated. Contact the office.'));
            }

            $this->recordGoogleProof($user, $googleUser->user['email_verified'] ?? false);

            // User exists, log them in
            Auth::login($user);

            // Set up user roles
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

            // Create token
            $token = $user->createToken('auth_token', ['server:access'], now()->addDays(10))->plainTextToken;

            // Prepare user data
            $userData = [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'gender' => $user->gender,
                'role' => [
                    'role' => $user->current_role->role
                ],
                'password_set' => $user->password_set_at !== null,
            ];

            // Redirect to frontend callback with data
            $callbackUrl = env('FRONTEND_URL', 'https://phdportal.thapar.edu') . '/google/callback?' . http_build_query([
                'token' => $token,
                'user' => json_encode($userData),
                'available_roles' => json_encode($user->availableRoles())
            ]);

            return redirect($callbackUrl);

        } catch (\Exception $e) {
            // Redirect to frontend with error
            return redirect(env('FRONTEND_URL', 'https://phdportal.thapar.edu') . '/google/callback?error=' . urlencode('Failed to authenticate with Google: ' . $e->getMessage()));
        }
    }

    /**
     * Google holding the mailbox is what the confirmation link asks a student
     * to prove, so it is recorded rather than asked for twice.
     */
    private function recordGoogleProof(User $user, $emailVerified): void
    {
        if ($emailVerified && !$user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }
    }

    /**
     * Parse Google display name into first and last name
     */
    private function parseGoogleName($fullName)
    {
        $parts = explode(' ', trim($fullName), 2);
        
        return [
            'first_name' => $parts[0] ?? 'User',
            'last_name' => $parts[1] ?? ''
        ];
    }

    /**
     * Login with Google token (for mobile/SPA)
     * Client sends the Google ID token (JWT), we verify it and log the user in
     */
    public function loginWithGoogleToken(Request $request)
    {
        $request->validate([
            'access_token' => 'required|string',
        ]);

        try {
            $client = new \Google_Client(['client_id' => config('services.google.client_id')]);
            $payload = $client->verifyIdToken($request->access_token);
            
            if (!$payload) {
                return response()->json([
                    'success' => false,
                    'error' => 'Invalid Google token'
                ], 401);
            }

            // Check if user exists by email
            $user = User::where('email', $payload['email'])->first();

            if (!$user) {
                // As above, with the ticket in the answer rather than the URL.
                if (UgStudent::eligibleEmail($payload['email'])) {
                    return response()->json([
                        'success' => false,
                        'signup' => UgSignupController::issueGoogleTicket($payload['email'], $payload['name'] ?? null),
                        'email' => $payload['email'],
                        'name' => $payload['name'] ?? null,
                    ], 404);
                }

                // User does not exist, return error
                return response()->json([
                    'success' => false,
                    'error' => 'No account found with this email. Please contact administrator.'
                ], 404);
            }

            if ($user->isDeactivated()) {
                return response()->json([
                    'success' => false,
                    'error' => 'This account has been deactivated. Contact the office.'
                ], 403);
            }

            $this->recordGoogleProof($user, $payload['email_verified'] ?? false);

            // User exists, log them in
            Auth::login($user);

            // Set up user roles
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

            // Create token
            $token = $user->createToken('auth_token', ['server:access'], now()->addDays(10))->plainTextToken;

            // Prepare user data
            $userData = [
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'email' => $user->email,
                'phone' => $user->phone,
                'gender' => $user->gender,
                'role' => [
                    'role' => $user->current_role->role
                ],
                'password_set' => $user->password_set_at !== null,
            ];

            return response()->json([
                'success' => true,
                'user' => $userData,
                'available_roles' => $user->availableRoles(),
                'token' => $token
            ], 200);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'Failed to authenticate with Google: ' . $e->getMessage()
            ], 401);
        }
    }
}
