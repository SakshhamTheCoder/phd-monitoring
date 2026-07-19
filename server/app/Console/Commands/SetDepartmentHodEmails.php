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
     * code => [email, confident?, official name for reporting]
     *
     * Confident entries are an unambiguous code match. Probable entries are a
     * judgement call about which local code the official name refers to, so
     * they need --include-probable and a human eye first.
     */
    private const MAPPING = [
        'DBT'  => ['hbtd@thapar.edu',  true,  'Biotechnology'],
        'CHED' => ['hched@thapar.edu', true,  'Chemical Engineering'],
        'CED'  => ['hced@thapar.edu',  true,  'Civil Engineering'],
        'CSED' => ['hcsed@thapar.edu', true,  'Computer Science & Engineering'],
        'EIED' => ['heied@thapar.edu', true,  'Electrical & Instrumentation Engineering'],
        'ECED' => ['heced@thapar.edu', true,  'Electronics & Communication Engineering'],
        'MED'  => ['hmed@thapar.edu',  true,  'Mechanical Engineering'],
        'SHSS' => ['hsmss@thapar.edu', true,  'School of Humanities & Social Sciences'],
        'DPMS' => ['hspms@thapar.edu', true,  'School of Physics & Materials Science'],

        'DCB'  => ['hscbc@thapar.edu', false, 'School of Chemistry & Biochemistry'],
        'DOM'  => ['hsom@thapar.edu',  false, 'School of Mathematics'],
        'DEE'  => ['hsee@thapar.edu',  false, 'School of Energy & Environment'],
    ];

    public function handle()
    {
        $apply = $this->option('apply');
        $includeProbable = $this->option('include-probable');
        $overwrite = $this->option('overwrite');

        $rows = [];
        $toWrite = [];
        $missing = [];

        foreach (self::MAPPING as $code => [$email, $confident, $officialName]) {
            $department = Department::where('code', $code)->first();
            $confidence = $confident ? 'CONFIRMED' : 'PROBABLE';

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

        $this->table(['Code', 'Confidence', 'Official email', 'Currently', 'Action'], $rows);

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
