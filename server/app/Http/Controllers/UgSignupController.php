<?php

namespace App\Http\Controllers;

use App\Helpers\CloudflareHelper;
use App\Models\Role;
use App\Models\UgStudent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * Sign-up for undergraduates applying to the Undergraduate Research Fellowship.
 *
 * This is the only way an account is created from outside: PhD scholars, staff
 * and faculty are still created by an admin. The account is useless until the
 * address is confirmed, which is what keeps the roll number honest, and it can
 * do nothing beyond the URF pages its role allows.
 */
class UgSignupController extends Controller
{
    /** How long a confirmation link stays good for. */
    private const LINK_DAYS = 3;

    /**
     * A ticket saying Google vouched for this address, handed to the sign-up
     * page and handed back with the rest of the form. Encrypted with the app
     * key, so it cannot be written by hand into the page's URL, and short
     * lived, so it is no use later.
     */
    public static function issueGoogleTicket(string $email, ?string $name): string
    {
        return Crypt::encryptString(json_encode([
            'email' => $email,
            'name' => $name,
            'expires' => now()->addMinutes(15)->timestamp,
        ]));
    }

    /** The address a ticket vouches for, or null if it is forged or stale. */
    private function readGoogleTicket(?string $ticket): ?string
    {
        if (!$ticket) {
            return null;
        }

        try {
            $payload = json_decode(Crypt::decryptString($ticket), true);
        } catch (\Exception $e) {
            return null;
        }

        return ($payload['expires'] ?? 0) >= now()->timestamp ? ($payload['email'] ?? null) : null;
    }

    public function signup(Request $request)
    {
        // Google has already asked who this is, so that sign-up needs no
        // captcha, no password and no confirmation email.
        $vouchedFor = $this->readGoogleTicket($request->google_ticket);
        if ($request->google_ticket && !$vouchedFor) {
            return response()->json(['error' => 'That Google sign-in has expired. Try again.'], 422);
        }

        if (!$vouchedFor && $request->captcha_token && !CloudflareHelper::verifyCaptcha($request->captcha_token)) {
            return response()->json(['error' => 'Captcha verification failed'], 422);
        }

        if ($vouchedFor) {
            $request->merge(['email' => $vouchedFor]);
        }

        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            // An undergraduate's institute address, which is who this is for.
            'email' => ['required', 'email', 'max:255', 'unique:users,email', function ($attribute, $value, $fail) {
                if (!UgStudent::eligibleEmail($value)) {
                    $fail('Use your institute address, the one carrying your programme and year, like name_be23@thapar.edu.');
                }
            }],
            'phone' => 'required|string|max:20',
            'gender' => 'required|in:Male,Female',
            'password' => ($vouchedFor ? 'nullable' : 'required') . '|string|min:8|confirmed',
            'roll_no' => 'required|string|max:50|unique:ug_students,roll_no',
            'department_id' => 'required|exists:departments,id',
            'year' => 'required|integer|between:1,4',
        ]);

        $role = Role::where('role', 'ug_student')->firstOrFail();

        $user = DB::transaction(function () use ($data, $role, $vouchedFor) {
            $user = new User();
            $user->first_name = $data['first_name'];
            $user->last_name = $data['last_name'];
            $user->email = $data['email'];
            $user->phone = $data['phone'];
            $user->gender = $data['gender'];
            // A Google sign-up sets no password: that account signs in the way
            // it was made, and Forgot Password can still give it one.
            $user->password = Hash::make($data['password'] ?? Str::random(40));
            $user->email_verified_at = $vouchedFor ? now() : null;
            $user->role_id = $role->id;
            $user->current_role_id = $role->id;
            $user->default_role_id = $role->id;
            $user->save();

            $user->ugStudent()->create([
                'roll_no' => $data['roll_no'],
                'department_id' => $data['department_id'],
                'year' => $data['year'],
            ]);

            return $user;
        });

        if ($vouchedFor) {
            return response()->json([
                'message' => 'Account created. Sign in with Google to apply.',
                'verified' => true,
            ], 201);
        }

        $this->sendVerificationEmail($user);

        return response()->json([
            'message' => "Account created. Confirm your email at {$user->email} to sign in.",
            'verified' => false,
        ], 201);
    }

    /**
     * The link from the email. Signed by Laravel, so the address is proven
     * without a token column of its own, and the student lands on the login
     * page rather than on a bare JSON response.
     */
    public function verify(Request $request, $id)
    {
        $login = rtrim(config('app.frontend_url'), '/') . '/login';
        $user = User::find($id);

        if (!$user || !hash_equals(sha1($user->email), (string) $request->query('hash'))) {
            return redirect($login . '?verified=invalid');
        }

        if (!$user->email_verified_at) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return redirect($login . '?verified=1');
    }

    /**
     * Another copy of the link. The answer never says whether the address is
     * one we hold, so this cannot be used to find out who has an account.
     */
    public function resend(Request $request)
    {
        $data = $request->validate(['email' => 'required|email']);

        $user = User::where('email', $data['email'])->whereNull('email_verified_at')->first();
        if ($user && $user->role?->role === 'ug_student') {
            $this->sendVerificationEmail($user);
        }

        return response()->json(['message' => 'If that address is waiting to be confirmed, the link is on its way.']);
    }

    private function sendVerificationEmail(User $user)
    {
        $url = URL::temporarySignedRoute('urf.verify-email', now()->addDays(self::LINK_DAYS), [
            'id' => $user->id,
            'hash' => sha1($user->email),
        ]);

        try {
            Mail::send('emails.ug_verify', [
                'name' => $user->name(),
                'verifyUrl' => $url,
                'days' => self::LINK_DAYS,
            ], function ($message) use ($user) {
                $message->to($user->email)->subject('Confirm your email - PhD Portal');
            });
        } catch (\Exception $e) {
            // The account is saved either way. The student can ask for the link
            // again rather than lose what they just filled in.
            Log::error('UG sign-up verification email failed: ' . $e->getMessage());
        }
    }
}
