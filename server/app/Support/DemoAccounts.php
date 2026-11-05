<?php

namespace App\Support;

use App\Models\User;

/** Demo accounts (config/demo_accounts.php) sort after everyone else in lists. */
final class DemoAccounts
{
    /**
     * Order a students or faculty query so demo accounts come last. Call it
     * before the name ordering; it does nothing when no demo accounts are set.
     */
    public static function sortLast($query, string $table)
    {
        $emails = config('demo_accounts.emails', []);
        if (!$emails) {
            return $query;
        }
        $marks = implode(',', array_fill(0, count($emails), '?'));

        return $query->orderBy(
            User::selectRaw("case when lower(email) in ($marks) then 1 else 0 end", $emails)
                ->whereColumn('users.id', "$table.user_id")
        );
    }
}
