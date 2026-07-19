<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Support\DepartmentCodes;
use Illuminate\Console\Command;

/**
 * Brings departments in line with the official listing on thapar.edu/academics:
 * the institute's own code, the full display name and the standing HoD address.
 *
 * All three come from one place. A department's subdomain is its code, and the
 * HoD address is that subdomain with an h in front, so som.thapar.edu gives the
 * code SOM and the address hsom@thapar.edu.
 *
 * Codes are the join key for the student and faculty CSV imports, so changing
 * them is the risky part. Two things make it safe: the faculty importer no
 * longer creates a department when a code does not resolve, and both importers
 * go through DepartmentCodes::resolve, which still accepts the superseded codes.
 * Spreadsheets saved before the rename keep working.
 *
 * This command only ever updates rows that already exist. It never creates a
 * department and never deletes one, and it refuses to rename a code onto one
 * that is already taken.
 */
class SetDepartmentHodEmails extends Command
{
    protected $signature = 'departments:sync-official
                            {--apply : Write the changes. Without this the command only reports.}
                            {--skip-codes : Leave codes alone, only sync names and HoD addresses.}
                            {--overwrite-email : Replace HoD addresses that are already set to something else.}';

    protected $description = 'Sync department codes, names and official HoD emails with the institute listing';

    /**
     * official code => [official name, hod email, official subdomain]
     *
     * Keyed by the official code. Departments still stored under a superseded
     * code are found through DepartmentCodes::LEGACY_ALIASES, so this command is
     * idempotent: it works before the rename and after it.
     *
     * LMTSM (lmtsm) and SLAS (tslas) are real departments with no HoD address in
     * the official list, so they are deliberately absent, as are the Dera Bassi
     * campus departments and DSAI.
     */
    private const MAPPING = [
        'BTD'  => ['Biotechnology',                              'hbtd@thapar.edu',  'btd'],
        'CHED' => ['Chemical Engineering',                       'hched@thapar.edu', 'ched'],
        'CED'  => ['Civil Engineering',                          'hced@thapar.edu',  'ced'],
        'CSED' => ['Computer Science & Engineering',             'hcsed@thapar.edu', 'csed'],
        'EIED' => ['Electrical & Instrumentation Engineering',   'heied@thapar.edu', 'eied'],
        'ECED' => ['Electronics & Communication Engineering',    'heced@thapar.edu', 'eced'],
        'MED'  => ['Mechanical Engineering',                     'hmed@thapar.edu',  'med'],
        'SMSS' => ['School of Humanities & Social Sciences',     'hsmss@thapar.edu', 'smss'],
        'SPMS' => ['Physics & Materials Science',                'hspms@thapar.edu', 'spms'],
        'SCBC' => ['Chemistry & Biochemistry',                   'hscbc@thapar.edu', 'scbc'],
        'SOM'  => ['Mathematics',                                'hsom@thapar.edu',  'som'],
        'SEE'  => ['Energy and Environment',                     'hsee@thapar.edu',  'see'],
    ];

    public function handle()
    {
        $apply = $this->option('apply');
        $skipCodes = $this->option('skip-codes');
        $overwriteEmail = $this->option('overwrite-email');

        $rows = [];
        $toWrite = [];
        $missing = [];

        foreach (self::MAPPING as $code => [$officialName, $email, $subdomain]) {
            // Finds the department whether it still carries the superseded code
            // or has already been renamed, which is what makes this idempotent.
            $department = DepartmentCodes::resolveOfficial($code);

            if (!$department) {
                $missing[] = [$code, $officialName, $email];
                $rows[] = [$code, $subdomain . '.thapar.edu', 'NOT IN THIS DATABASE', '', 'skip'];
                continue;
            }

            $changes = [];

            if (!$skipCodes && $department->code !== $code) {
                // Never collapse two departments into one code. Codes have no
                // unique index, so nothing at the database level would stop it.
                $taken = Department::whereRaw('UPPER(code) = ?', [strtoupper($code)])
                    ->where('id', '!=', $department->id)
                    ->first();

                if ($taken) {
                    $this->error("{$department->code}: cannot rename to {$code}, department #{$taken->id} already uses it. Resolve by hand.");
                } else {
                    $changes['code'] = $code;
                }
            }

            if ($department->name !== $officialName) {
                $changes['name'] = $officialName;
            }

            $currentEmail = $department->hod_email;
            if ($currentEmail !== $email) {
                if ($currentEmail && !$overwriteEmail) {
                    $this->warn("{$code} already has {$currentEmail}, leaving it (use --overwrite-email to replace).");
                } else {
                    $changes['hod_email'] = $email;
                }
            }

            if (empty($changes)) {
                $rows[] = [$department->code, $subdomain . '.thapar.edu', $department->name, $currentEmail ?? '(none)', 'up to date'];
                continue;
            }

            $rows[] = [
                array_key_exists('code', $changes) ? $department->code . ' -> ' . $changes['code'] : $department->code,
                $subdomain . '.thapar.edu',
                array_key_exists('name', $changes) ? $department->name . ' -> ' . $changes['name'] : $department->name,
                array_key_exists('hod_email', $changes) ? ($currentEmail ?: '(none)') . ' -> ' . $changes['hod_email'] : ($currentEmail ?? '(none)'),
                $apply ? 'WRITING' : 'would write',
            ];
            $toWrite[] = [$department, $changes];
        }

        $this->table(['Code', 'Official site', 'Name', 'HoD email', 'Action'], $rows);

        if (!empty($missing)) {
            $this->warn('Not in this database, so nothing was written for them:');
            foreach ($missing as [$code, $name, $email]) {
                $this->line("  {$code}  {$name}  ({$email})");
            }
            $this->line('No department is ever created by this command. Add them by hand if they should exist.');
        }

        if (empty($toWrite)) {
            $this->info('Everything is already up to date.');
            return self::SUCCESS;
        }

        if (!$apply) {
            $this->newLine();
            $this->warn(count($toWrite) . ' department(s) would be updated. Re-run with --apply to write.');
            return self::SUCCESS;
        }

        foreach ($toWrite as [$department, $changes]) {
            $department->fill($changes);
            $department->save();
        }

        $this->info('Updated ' . count($toWrite) . ' department(s). Nothing was created or deleted.');

        return self::SUCCESS;
    }
}
