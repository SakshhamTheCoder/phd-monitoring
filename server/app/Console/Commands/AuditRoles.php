<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Support\RoleRequirements;
use Illuminate\Console\Command;

/**
 * Reports users holding a role that no data backs.
 *
 * Roles and their linkage records live in separate tables with nothing keeping
 * them in step, so drift is silent, the role looks assigned and simply never
 * works. This surfaces it. Read-only; it changes nothing.
 */
class AuditRoles extends Command
{
    protected $signature = 'roles:audit {--current-only : Only check each user\'s current role, i.e. what would break right now}';

    protected $description = 'Report users whose granted roles have no backing record (faculty, student, coordinator, HOD, ADORDC)';

    public function handle()
    {
        $currentOnly = $this->option('current-only');
        $rows = [];

        User::with(['faculty', 'student', 'role', 'current_role'])->chunk(200, function ($users) use (&$rows, $currentOnly) {
            foreach ($users as $user) {
                $roles = $currentOnly
                    ? array_filter([optional($user->current_role)->role])
                    : $this->grantedRoles($user);

                foreach ($roles as $role) {
                    $reason = RoleRequirements::unmet($user, $role);
                    if ($reason !== null) {
                        $rows[] = [
                            $user->id,
                            trim($user->name()),
                            $user->email,
                            $role,
                            $reason,
                        ];
                    }
                }
            }
        });

        if (empty($rows)) {
            $this->info($currentOnly
                ? 'No users are currently acting in a role that lacks its backing record.'
                : 'No users hold a role that lacks its backing record.');
            return self::SUCCESS;
        }

        $this->warn(count($rows) . ' role assignment(s) have no backing record:');
        $this->table(['User ID', 'Name', 'Email', 'Role', 'Problem'], $rows);

        return self::SUCCESS;
    }

    /**
     * Every role the user holds: the stored available_roles plus their main and
     * current role. Reads the raw column rather than availableRoles(), which
     * would derive and persist a list as a side effect of auditing.
     *
     * @return array<int, string>
     */
    private function grantedRoles(User $user): array
    {
        $stored = $user->getAttributes()['available_roles'] ?? null;
        $decoded = $stored ? json_decode($stored, true) : [];

        return array_values(array_unique(array_filter(array_merge(
            is_array($decoded) ? $decoded : [],
            [optional($user->role)->role, optional($user->current_role)->role]
        ))));
    }
}
