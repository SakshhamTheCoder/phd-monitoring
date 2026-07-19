<?php

namespace App\Console\Commands;

use App\Models\Department;
use Illuminate\Console\Command;

/**
 * Brings departments in line with the official listing on thapar.edu/academics:
 * the full display name and the standing HoD address.
 *
 * Matches on `code` and never writes it. Codes are the join key for the student
 * and faculty CSV imports, and the faculty importer creates a department when a
 * code does not resolve, so renaming codes would let one stale spreadsheet
 * silently fill the table with duplicates. Names are display only, nothing
 * resolves a department by name, so they are safe to correct.
 *
 * This command only ever updates rows that already exist. It never creates a
 * department and never deletes one.
 */
class SetDepartmentHodEmails extends Command
{
    protected $signature = 'departments:sync-official
                            {--apply : Write the changes. Without this the command only reports.}
                            {--emails-only : Set the HoD addresses but leave the display names alone.}
                            {--overwrite-email : Replace HoD addresses that are already set to something else.}';

    protected $description = 'Sync department names and official HoD emails with the institute listing';

    /**
     * local code => [official name, hod email, official subdomain]
     *
     * Every address is `h` plus the department's own subdomain as listed on
     * thapar.edu/academics, which is what makes these verifiable rather than
     * guessed: scbc.thapar.edu gives hscbc@thapar.edu, and so on.
     *
     * The codes stored here are not the official abbreviations. DBT is btd, DCB
     * is scbc, DOM is som, DEE is see, DPMS is spms and SHSS is smss, so the
     * subdomain is recorded as the evidence for each pairing.
     *
     * LMTSM (lmtsm) and SLAS (tslas) are real departments with no HoD address in
     * the official list, so they are deliberately absent, as are the Dera Bassi
     * campus departments and DSAI.
     */
    private const MAPPING = [
        'DBT'  => ['Biotechnology',                              'hbtd@thapar.edu',  'btd'],
        'CHED' => ['Chemical Engineering',                       'hched@thapar.edu', 'ched'],
        'CED'  => ['Civil Engineering',                          'hced@thapar.edu',  'ced'],
        'CSED' => ['Computer Science & Engineering',             'hcsed@thapar.edu', 'csed'],
        'EIED' => ['Electrical & Instrumentation Engineering',   'heied@thapar.edu', 'eied'],
        'ECED' => ['Electronics & Communication Engineering',    'heced@thapar.edu', 'eced'],
        'MED'  => ['Mechanical Engineering',                     'hmed@thapar.edu',  'med'],
        'SHSS' => ['School of Humanities & Social Sciences',     'hsmss@thapar.edu', 'smss'],
        'DPMS' => ['Physics & Materials Science',                'hspms@thapar.edu', 'spms'],
        'DCB'  => ['Chemistry & Biochemistry',                   'hscbc@thapar.edu', 'scbc'],
        'DOM'  => ['Mathematics',                                'hsom@thapar.edu',  'som'],
        'DEE'  => ['Energy and Environment',                     'hsee@thapar.edu',  'see'],
    ];

    public function handle()
    {
        $apply = $this->option('apply');
        $emailsOnly = $this->option('emails-only');
        $overwriteEmail = $this->option('overwrite-email');

        $rows = [];
        $toWrite = [];
        $missing = [];

        foreach (self::MAPPING as $code => [$officialName, $email, $subdomain]) {
            $department = Department::where('code', $code)->first();

            if (!$department) {
                $missing[] = [$code, $officialName, $email];
                $rows[] = [$code, $subdomain . '.thapar.edu', 'NOT IN THIS DATABASE', '', 'skip'];
                continue;
            }

            $changes = [];

            if (!$emailsOnly && $department->name !== $officialName) {
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
                $rows[] = [$code, $subdomain . '.thapar.edu', $department->name, $currentEmail ?? '(none)', 'up to date'];
                continue;
            }

            $rows[] = [
                $code,
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

        $this->info('Updated ' . count($toWrite) . ' department(s). Codes were not touched.');

        return self::SUCCESS;
    }
}
