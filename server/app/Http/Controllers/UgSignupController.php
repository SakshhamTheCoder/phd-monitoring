<?php

namespace App\Http\Controllers;

use App\Helpers\CloudflareHelper;
use App\Models\Role;
use App\Models\UgStudent;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;

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

    public function signup(Request $request)
    {
        if ($request->captcha_token && !CloudflareHelper::verifyCaptcha($request->captcha_token)) {
            return response()->json(['error' => 'Captcha verification failed'], 422);
        }

        $data = $request->validate([
            'first_name' => 'required|string|max:255',
            'last_name' => 'required|string|max:255',
            // Institute addresses only, which is what ties an account to a student.
            'email' => 'required|email|max:255|ends_with:@thapar.edu|unique:users,email',
            'phone' => 'required|string|max:20',
            'gender' => 'required|in:Male,Female',
            'password' => 'required|string|min:8|confirmed',
            'roll_no' => 'required|string|max:50|unique:ug_students,roll_no',
            'department_id' => 'required|exists:departments,id',
            'year' => 'required|integer|between:1,4',
        ]);

        $role = Role::where('role', 'ug_student')->firstOrFail();

        $user = DB::transaction(function () use ($data, $role) {
            $user = new User();
            $user->first_name = $data['first_name'];
            $user->last_name = $data['last_name'];
            $user->email = $data['email'];
            $user->phone = $data['phone'];
            $user->gender = $data['gender'];
            $user->password = Hash::make($data['password']);
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

        $this->sendVerificationEmail($user);

        return response()->json([
            'message' => "Account created. Confirm your email at {$user->email} to sign in.",
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
