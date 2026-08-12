<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Models\Faculty;
use App\Models\OutsideExpert;
use App\Models\PhdCoordinator;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Builds and tears down the five-person demo cast in one go.
 *
 *   php artisan demo:accounts                  create, print the credentials
 *   php artisan demo:accounts --list           show what currently exists
 *   php artisan demo:accounts --remove         delete every one of them
 *
 * Two things make this safe to run against production.
 *
 * Nothing is emailed. Accounts are written straight through Eloquent rather
 * than the admin screens, which notify the new user of their credentials. Every
 * address also sits under .invalid, a TLD RFC 2606 reserves precisely so it can
 * never resolve, so even a stray send cannot reach a real person.
 *
 * Nothing real is touched. The cast lives in its own department, so no existing
 * department has its HOD or ADORDC pointer moved, and --remove only ever
 * deletes rows whose email ends in the marker below.
 */
class DemoAccounts extends Command
{
    protected $signature = 'demo:accounts
        {--remove : Delete the demo cast instead of creating it}
        {--list : Show what exists and change nothing}
        {--expert-email= : Real address for the one outside expert DORDC will pick}
        {--password=DemoPass#2026 : Shared password for every demo account}';

    protected $description = 'Create or remove the five-person demo cast, without sending any mail';

    private const MARKER = '@demo.invalid';
    private const DEPARTMENT_CODE = 'DEMO';

    /**
     * Outside experts are matched on this rather than the email marker, because
     * one of the three is deliberately given a real address. It is still a row
     * this command created, so it should still be a row this command removes.
     */
    private const EXPERT_INSTITUTION = 'Demo Institute';

    /** faculty_code and roll_no are assigned, not auto-increment, so pick a range of our own. */
    private const FACULTY_CODES = ['p2' => 990002, 'p3' => 990003, 'p4' => 990004, 'p5' => 990005];
    private const ROLL_NO = 990001;

    /**
     * available_roles is an explicit override. Without it the app derives the
     * switchable set from the base role, and that derivation never pairs the
     * roles we want on one person. Note director is the one role it does not
     * grant faculty alongside, so P4 has to be spelled out.
     */
    private const CAST = [
        'p2' => ['email' => 'p2.supervisor', 'name' => ['Priya', 'Supervisor'], 'base' => 'faculty',
                 'roles' => ['faculty', 'doctoral']],
        'p3' => ['email' => 'p3.hod', 'name' => ['Rahul', 'Head'], 'base' => 'hod',
                 'roles' => ['hod', 'phd_coordinator', 'doctoral', 'faculty']],
        'p4' => ['email' => 'p4.dordc', 'name' => ['Anjali', 'Dordc'], 'base' => 'dordc',
                 'roles' => ['dordc', 'director', 'doctoral', 'faculty']],
        'p5' => ['email' => 'p5.dra', 'name' => ['Vikram', 'Dra'], 'base' => 'dra',
                 'roles' => ['dra', 'adordc', 'doctoral', 'faculty']],
    ];

    public function handle(): int
    {
        if ($this->option('list')) {
            return $this->showExisting();
        }

        return $this->option('remove') ? $this->remove() : $this->create();
    }

    private function create(): int
    {
        $roles = Role::pluck('id', 'role');
        foreach (['student', 'faculty', 'hod', 'phd_coordinator', 'dordc', 'director', 'dra', 'adordc', 'doctoral'] as $needed) {
            if (!isset($roles[$needed])) {
                $this->error("The roles table has no '{$needed}' row. Seed roles before running this.");
                return self::FAILURE;
            }
        }

        $password = $this->option('password');
        $expertEmail = $this->option('expert-email');

        DB::transaction(function () use ($roles, $password, $expertEmail) {
            $department = Department::firstOrCreate(
                ['code' => self::DEPARTMENT_CODE],
                ['name' => 'Demo Department']
            );

            foreach (self::CAST as $key => $person) {
                $user = $this->makeUser($person, $roles, $password);

                Faculty::updateOrCreate(
                    ['faculty_code' => self::FACULTY_CODES[$key]],
                    [
                        'user_id' => $user->id,
                        'designation' => 'Assistant Professor',
                        'department_id' => $department->id,
                    ]
                );
            }

            // The department's own pointers. Kept on the demo department so no
            // real department has its HOD or ADORDC replaced.
            $department->hod_id = self::FACULTY_CODES['p3'];
            $department->adordc_id = self::FACULTY_CODES['p5'];
            $department->save();

            PhdCoordinator::firstOrCreate([
                'department_id' => $department->id,
                'faculty_id' => self::FACULTY_CODES['p3'],
            ]);

            $student = $this->makeUser(
                ['email' => 'p1.student', 'name' => ['Sameer', 'Student'], 'base' => 'student', 'roles' => ['student']],
                $roles,
                $password
            );

            Student::updateOrCreate(
                ['roll_no' => self::ROLL_NO],
                [
                    'user_id' => $student->id,
                    'department_id' => $department->id,
                    'date_of_registration' => now()->subYear()->toDateString(),
                    'current_status' => 'full-time',
                    'overall_progress' => 0,
                ]
            );

            $this->makeExperts($expertEmail);
        });

        $this->newLine();
        $this->info('Demo cast created. Password for every account: ' . $password);
        $this->newLine();
        $this->showExisting();

        if (!$expertEmail) {
            $this->newLine();
            $this->warn('No --expert-email given, so all three outside experts are placeholders.');
            $this->warn('Re-run with --expert-email=you@yourdomain.com so the Revised IRB link reaches an inbox you own.');
        }

        return self::SUCCESS;
    }

    private function makeUser(array $person, $roles, string $password): User
    {
        $roleId = $roles[$person['base']];

        $user = User::updateOrCreate(
            ['email' => $person['email'] . self::MARKER],
            [
                'first_name' => $person['name'][0],
                'last_name' => $person['name'][1],
                'password' => Hash::make($password),
                'role_id' => $roleId,
                'current_role_id' => $roleId,
                'default_role_id' => $roleId,
                // Both are strings in this schema, not booleans. 'false' here is
                // what stops the first login demanding a password change.
                'first_activation' => 'false',
                'status' => 'active',
                'available_roles' => $person['roles'],
                'email_verified_at' => now(),
            ]
        );

        return $user;
    }

    /**
     * Three experts, because the HOD step refuses anything other than exactly
     * three distinct ones. Only the expert DORDC picks is ever contacted, so
     * just one needs to be reachable.
     */
    private function makeExperts(?string $expertEmail): void
    {
        $experts = [
            ['Expert', 'A (pick this one)', $expertEmail ?: 'expert.a' . self::MARKER],
            ['Expert', 'B (never selected)', 'expert.b' . self::MARKER],
            ['Expert', 'C (never selected)', 'expert.c' . self::MARKER],
        ];

        foreach ($experts as [$first, $last, $email]) {
            OutsideExpert::updateOrCreate(
                ['email' => $email],
                [
                    'first_name' => $first,
                    'last_name' => $last,
                    'designation' => 'Professor',
                    'institution' => self::EXPERT_INSTITUTION,
                    'department' => 'Demo Department',
                ]
            );
        }
    }

    private function remove(): int
    {
        if (!$this->confirmToProceed()) {
            return self::FAILURE;
        }

        $counts = [];

        DB::transaction(function () use (&$counts) {
            $department = Department::where('code', self::DEPARTMENT_CODE)->first();
            $userIds = User::where('email', 'like', '%' . self::MARKER)->pluck('id');

            // Clear the pointers before the rows they point at go away.
            if ($department) {
                $department->hod_id = null;
                $department->adordc_id = null;
                $department->save();

                $counts['coordinator rows'] = PhdCoordinator::where('department_id', $department->id)->delete();
            }

            $counts['students'] = Student::whereIn('user_id', $userIds)->delete();
            $counts['faculty'] = Faculty::whereIn('user_id', $userIds)->delete();
            $counts['users'] = User::whereIn('id', $userIds)->delete();

            $counts['outside experts'] = OutsideExpert::where('institution', self::EXPERT_INSTITUTION)->delete();

            if ($department) {
                $counts['department'] = Department::where('code', self::DEPARTMENT_CODE)->delete();
            }
        });

        $this->newLine();
        foreach ($counts as $what => $n) {
            $this->line(sprintf('  removed %-18s %d', $what, $n));
        }
        $this->newLine();
        $this->info('Demo cast removed. Nothing outside the demo department was touched.');

        return self::SUCCESS;
    }

    private function confirmToProceed(): bool
    {
        if ($this->option('no-interaction')) {
            return true;
        }

        return $this->confirm(
            'Delete every account ending in ' . self::MARKER . ' and the ' . self::DEPARTMENT_CODE . ' department?',
            true
        );
    }

    private function showExisting(): int
    {
        $users = User::where('email', 'like', '%' . self::MARKER)
            ->orderBy('email')
            ->get(['email', 'first_name', 'available_roles', 'status']);

        if ($users->isEmpty()) {
            $this->warn('No demo accounts exist. Run without --list to create them.');
            return self::SUCCESS;
        }

        $rows = $users->map(fn ($u) => [
            $u->email,
            is_array($u->available_roles) ? implode(', ', $u->available_roles) : (string) $u->available_roles,
            $u->status,
        ])->all();

        $this->table(['Email', 'Can switch between', 'Status'], $rows);

        foreach (OutsideExpert::where('institution', self::EXPERT_INSTITUTION)->orderBy('email')->get() as $expert) {
            $reachable = !str_ends_with($expert->email, self::MARKER);
            $this->line(sprintf('  expert  %-34s %s', $expert->email, $reachable ? 'REAL address, DORDC must pick this one' : 'placeholder'));
        }

        return self::SUCCESS;
    }
}
