<?php

namespace App\Console\Commands;

use App\Models\Department;
use Illuminate\Console\Command;

/**
 * Populates the official departmental HoD addresses.
 *
 * Matches on department code rather than name, since names vary between the
 * official list and what is stored. Reports and does nothing unless --apply is
 * passed, because this is meant to be run against production.
 *
 * Derabassi campus departments are deliberately absent: the official list has
 * no address for them.
 */
class SetDepartmentHodEmails extends Command
{
    protected $signature = 'departments:set-hod-emails
                            {--apply : Write the changes. Without this the command only reports.}
                            {--include-probable : Also apply the codes marked PROBABLE below.}
                            {--overwrite : Replace addresses that are already set.}';

    protected $description = 'Set the official HoD email on each department';

    /**
     * local code => [email, confident?, official name, official subdomain]
     *
     * Every address is `h` plus the department's own subdomain as listed on
     * thapar.edu/academics, which is what makes these verifiable rather than
     * guessed: scbc.thapar.edu gives hscbc@thapar.edu, and so on.
     *
     * The codes stored here do not always match the official abbreviation.
     * DBT is btd, DCB is scbc, DOM is som, DEE is see, DPMS is spms and SHSS is
     * smss, so the subdomain column is the evidence for each pairing.
     *
     * LMTSM (lmtsm) and SLAS (tslas) are real departments with no HoD address
     * in the official list, so they are deliberately absent, as are the Dera
     * Bassi campus departments.
     */
    private const MAPPING = [
        'DBT'  => ['hbtd@thapar.edu',  true, 'Department of Biotechnology',                    'btd'],
        'CHED' => ['hched@thapar.edu', true, 'Chemical Engineering',                           'ched'],
        'CED'  => ['hced@thapar.edu',  true, 'Civil Engineering',                              'ced'],
        'CSED' => ['hcsed@thapar.edu', true, 'Computer Science & Engineering',                 'csed'],
        'EIED' => ['heied@thapar.edu', true, 'Electrical & Instrumentation Engineering',       'eied'],
        'ECED' => ['heced@thapar.edu', true, 'Electronics & Communication Engineering',        'eced'],
        'MED'  => ['hmed@thapar.edu',  true, 'Mechanical Engineering Department',              'med'],
        'SHSS' => ['hsmss@thapar.edu', true, 'School of Humanities & Social Sciences',         'smss'],
        'DPMS' => ['hspms@thapar.edu', true, 'Department of Physics & Materials Science',      'spms'],
        'DCB'  => ['hscbc@thapar.edu', true, 'Department of Chemistry & Biochemistry',         'scbc'],
        'DOM'  => ['hsom@thapar.edu',  true, 'Department of Mathematics',                      'som'],
        'DEE'  => ['hsee@thapar.edu',  true, 'Department of Energy and Environment',           'see'],
    ];

    public function handle()
    {
        $apply = $this->option('apply');
        $includeProbable = $this->option('include-probable');
        $overwrite = $this->option('overwrite');

        $rows = [];
        $toWrite = [];
        $missing = [];

        foreach (self::MAPPING as $code => [$email, $confident, $officialName, $subdomain]) {
            $department = Department::where('code', $code)->first();
            $confidence = $confident ? $subdomain . '.thapar.edu' : 'PROBABLE';

            if (!$department) {
                $missing[] = [$code, $officialName, $email];
                $rows[] = [$code, $confidence, $email, 'NO SUCH DEPARTMENT', 'skip'];
                continue;
            }

            $current = $department->hod_email;

            if ($current === $email) {
                $rows[] = [$code, $confidence, $email, $current, 'already set'];
                continue;
            }

            if ($current && !$overwrite) {
                $rows[] = [$code, $confidence, $email, $current, 'has another address, skip (use --overwrite)'];
                continue;
            }

            if (!$confident && !$includeProbable) {
                $rows[] = [$code, $confidence, $email, $current ?? '(none)', 'skip (use --include-probable)'];
                continue;
            }

            $rows[] = [$code, $confidence, $email, $current ?? '(none)', $apply ? 'WRITING' : 'would write'];
            $toWrite[] = [$department, $email];
        }

        $this->table(['Code', 'Official site', 'Official email', 'Currently', 'Action'], $rows);

        if (!empty($missing)) {
            $this->warn('These departments are not in this database, so nothing was set for them:');
            foreach ($missing as [$code, $name, $email]) {
                $this->line("  {$code}  {$name}  ({$email})");
            }
        }

        if (empty($toWrite)) {
            $this->info('Nothing to write.');
            return self::SUCCESS;
        }

        if (!$apply) {
            $this->newLine();
            $this->warn(count($toWrite) . ' department(s) would be updated. Re-run with --apply to write.');
            return self::SUCCESS;
        }

        foreach ($toWrite as [$department, $email]) {
            $department->hod_email = $email;
            $department->save();
        }

        $this->info('Updated ' . count($toWrite) . ' department(s).');

        return self::SUCCESS;
    }
}
