<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Replaces any login still using one of the two passwords that were printed in
 * the source.
 *
 * Until the change that accompanies this migration, an expert pulled onto a
 * doctoral committee got an account created for them with a hardcoded role id
 * and a shared password: `password123` with role id 1, or `Password@123` with
 * role id 4. Anyone who read the repository could sign in as one of them.
 *
 * Only the password is repaired here. Earlier versions of this migration also
 * forced accounts with a 777 faculty code onto the `external` role, assuming
 * nothing else produces such a code and that the role was therefore wrong.
 * Production disproved both halves: the DRA and DoRDC test accounts were
 * numbered by hand in that range, and the one account that really was created
 * by the expert routine is now a PhD coordinator. Demoting them would have
 * taken away roles somebody deliberately granted.
 *
 * A weak password is evidence. A faculty code is not. So the password is the
 * only thing this touches and the role is left exactly as an administrator set
 * it. An account whose password has already been changed is left alone, because
 * there is then nothing left to show it ever came from that routine.
 *
 * Candidates are limited to the 777 range so this is a handful of hash
 * comparisons rather than one for every user in the portal.
 *
 * Not reversible: putting a known password back would be the defect.
 */
return new class extends Migration
{
    private const LEAKED_PASSWORDS = ['password123', 'Password@123'];

    public function up(): void
    {
        $accounts = DB::table('faculty')
            ->join('users', 'users.id', '=', 'faculty.user_id')
            ->where('faculty.faculty_code', 'like', '777%')
            ->select('users.id', 'users.email', 'users.password')
            ->get();

        $reset = [];

        foreach ($accounts as $account) {
            foreach (self::LEAKED_PASSWORDS as $leaked) {
                if ($account->password && Hash::check($leaked, $account->password)) {
                    DB::table('users')->where('id', $account->id)
                        ->update(['password' => bcrypt(Str::password(24))]);
                    $reset[] = $account->email;
                    break;
                }
            }
        }

        // Anyone whose password is replaced can no longer sign in with it, so
        // name them rather than leaving an administrator to find out.
        if ($reset) {
            file_put_contents(
                storage_path('logs/leaked-password-reset.log'),
                now()->toDateTimeString() . ' reset the password on: ' . implode(', ', $reset) . "\n",
                FILE_APPEND
            );
        }
    }

    public function down(): void
    {
        // Nothing to undo. Restoring a password printed in the source would
        // put the hole back.
    }
};
