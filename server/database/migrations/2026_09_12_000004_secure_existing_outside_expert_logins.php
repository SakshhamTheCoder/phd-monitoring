<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Repairs the accounts the two outside expert creators left behind.
 *
 * Until the change that accompanies this migration, an expert pulled onto a
 * doctoral committee got a login with a hardcoded role id and one of two shared
 * passwords: `password123` with role id 1, or `Password@123` with role id 4.
 * Role id 1 is the admin row on this install, so an external examiner could sign
 * in with a password printed in the source and hold administrative access.
 *
 * Such an account is an external faculty record whose code begins 777. Both
 * halves matter: the prefix alone is not enough, because test accounts for the
 * DRA and DoRDC roles were created by hand with codes like 77758899, and they
 * are internal staff who must keep the role they were given. `type` is what
 * actually says the record was made for someone outside the institute.
 *
 * Matching accounts are moved to the `external` role and any password still set
 * to one of the two literals is replaced with a random one. Experts reach their
 * reviews through a signed link, so nobody loses access.
 *
 * The local database is not a copy of production. Run the same check there.
 *
 * Not reversible: putting a known password back would be the defect.
 */
return new class extends Migration
{
    private const LEAKED_PASSWORDS = ['password123', 'Password@123'];

    public function up(): void
    {
        $externalRoleId = DB::table('roles')->where('role', 'external')->value('id');
        if (!$externalRoleId) {
            return;
        }

        $accounts = DB::table('faculty')
            ->join('users', 'users.id', '=', 'faculty.user_id')
            ->where('faculty.faculty_code', 'like', '777%')
            ->where('faculty.type', 'external')
            ->select('users.id', 'users.password', 'users.role_id', 'users.current_role_id', 'users.default_role_id')
            ->get();

        foreach ($accounts as $account) {
            $changes = [];

            if ($account->role_id != $externalRoleId
                || $account->current_role_id != $externalRoleId
                || $account->default_role_id != $externalRoleId) {
                $changes['role_id'] = $externalRoleId;
                $changes['current_role_id'] = $externalRoleId;
                $changes['default_role_id'] = $externalRoleId;
            }

            foreach (self::LEAKED_PASSWORDS as $leaked) {
                if ($account->password && Hash::check($leaked, $account->password)) {
                    $changes['password'] = bcrypt(Str::password(24));
                    break;
                }
            }

            if ($changes) {
                DB::table('users')->where('id', $account->id)->update($changes);
            }
        }
    }

    public function down(): void
    {
        // Nothing to undo. Restoring a password printed in the source would
        // put the hole back.
    }
};
