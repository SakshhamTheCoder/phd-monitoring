<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Support\DepartmentCodes;
use Illuminate\Console\Command;

/**
 * Brings departments in line with the department officers sheet: the code the
 * institute uses for each department, and the standing HoD address.
 *
 * The two no longer come from one place. The HoD address is still the thapar.edu
 * subdomain with an h in front (hsom@thapar.edu), but the officers sheet calls
 * that department DOM, not SOM, and the same split applies to DEE, DPMS, DCBC
 * and DHSS. The sheet is the authority for the code; the subdomain survives only
 * as the address.
 *
 * The stored name is kept identical to the code, which is how the portal has
 * always displayed departments.
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
                            {--skip-codes : Leave codes and names alone, only sync HoD addresses.}
                            {--overwrite-email : Replace HoD addresses that are already set to something else.}';

    protected $description = 'Sync department codes, names and official HoD emails with the institute listing';

    /**
     * official code => [hod email, official subdomain, full title for reference]
     *
     * The stored name is the code itself, which is how the portal has always
     * shown departments and what people recognise. The full title is here only
     * so the report can show what each code stands for.
     *
     * Keyed by the official code. Departments still stored under a superseded
     * code are found through DepartmentCodes::LEGACY_ALIASES, so this command is
     * idempotent: it works before the rename and after it.
     *
     * LMTSM, TSLAS and CoE-DSAI are real departments with no HoD address in the
     * official list, so they are absent here. The two that still need a code
     * change are in CODE_ONLY_RENAMES instead.
     */
    private const MAPPING = [
        'BTD'  => ['hbtd@thapar.edu',  'btd',  'Biotechnology'],
        'CHED' => ['hched@thapar.edu', 'ched', 'Chemical Engineering'],
        'CED'  => ['hced@thapar.edu',  'ced',  'Civil Engineering'],
        'CSED' => ['hcsed@thapar.edu', 'csed', 'Computer Science & Engineering'],
        'EIED' => ['heied@thapar.edu', 'eied', 'Electrical & Instrumentation Engineering'],
        'ECED' => ['heced@thapar.edu', 'eced', 'Electronics & Communication Engineering'],
        'MED'  => ['hmed@thapar.edu',  'med',  'Mechanical Engineering'],
        'DHSS' => ['hsmss@thapar.edu', 'smss', 'School of Humanities & Social Sciences'],
        'DPMS' => ['hspms@thapar.edu', 'spms', 'Physics & Materials Science'],
        'DCBC' => ['hscbc@thapar.edu', 'scbc', 'Chemistry & Biochemistry'],
        'DOM'  => ['hsom@thapar.edu',  'som',  'Mathematics'],
        'DEE'  => ['hsee@thapar.edu',  'see',  'Energy and Environment'],
    ];

    /**
     * Departments whose code changes but which have no HoD address to set.
     *
     * Two kinds. The Dera Bassi campus departments follow their main campus
     * counterpart and only need the suffix normalised, which was stored three
     * ways (Derabassi, DeraBassi, Dera Bassi). TSLAS and CoE-DSAI are main
     * campus departments the official listing carries no address for.
     *
     * current code => corrected code
     */
    private const CODE_ONLY_RENAMES = [
        'DCB (Derabassi)'   => 'SCBC (Derabassi)',
        'DOM (Derabassi)'   => 'SOM (Derabassi)',
        'DPMS (DeraBassi)'  => 'SPMS (Derabassi)',
        'EIED (Dera Bassi)' => 'EIED (Derabassi)',

        'SLAS' => 'TSLAS',
        'DSAI' => 'CoE-DSAI',
    ];

    public function handle()
    {
        $apply = $this->option('apply');
        $skipCodes = $this->option('skip-codes');
        $overwriteEmail = $this->option('overwrite-email');

        $rows = [];
        $toWrite = [];
        $missing = [];

        foreach (self::MAPPING as $code => [$email, $subdomain, $fullTitle]) {
            // The stored name is the code. Keeping them identical is what the
            // portal has always shown and what the department typeahead matches
            // most naturally.
            $officialName = $code;

            // Finds the department whether it still carries the superseded code
            // or has already been renamed, which is what makes this idempotent.
            $department = DepartmentCodes::resolveOfficial($code);

            if (!$department) {
                $missing[] = [$code, $fullTitle, $email];
                $rows[] = [$code, $fullTitle, 'NOT IN THIS DATABASE', '', 'skip'];
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

            // Name follows the code, so skipping one has to skip the other or
            // the two would end up disagreeing.
            if (!$skipCodes && $department->name !== $officialName) {
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
                $rows[] = [$department->code, $fullTitle, $department->name, $currentEmail ?? '(none)', 'up to date'];
                continue;
            }

            $rows[] = [
                array_key_exists('code', $changes) ? $department->code . ' -> ' . $changes['code'] : $department->code,
                $fullTitle,
                array_key_exists('name', $changes) ? $department->name . ' -> ' . $changes['name'] : $department->name,
                array_key_exists('hod_email', $changes) ? ($currentEmail ?: '(none)') . ' -> ' . $changes['hod_email'] : ($currentEmail ?? '(none)'),
                $apply ? 'WRITING' : 'would write',
            ];
            $toWrite[] = [$department, $changes];
        }

        // Handled separately from MAPPING because these carry no HoD address,
        // so there is nothing to sync beyond the code and the name.
        if (!$skipCodes) {
            foreach (self::CODE_ONLY_RENAMES as $currentCode => $correctedCode) {
                $department = Department::whereRaw('UPPER(code) = ?', [strtoupper($currentCode)])->first();

                if (!$department) {
                    // Already renamed, or never existed here. Either way nothing
                    // to do, and nothing is created.
                    continue;
                }

                $taken = Department::whereRaw('UPPER(code) = ?', [strtoupper($correctedCode)])
                    ->where('id', '!=', $department->id)
                    ->first();

                if ($taken) {
                    $this->error("{$currentCode}: cannot rename to {$correctedCode}, department #{$taken->id} already uses it. Resolve by hand.");
                    continue;
                }

                $rows[] = [
                    $department->code . ' -> ' . $correctedCode,
                    'code only, no HoD address',
                    $department->name . ' -> ' . $correctedCode,
                    '(none)',
                    $apply ? 'WRITING' : 'would write',
                ];
                $toWrite[] = [$department, ['code' => $correctedCode, 'name' => $correctedCode]];
            }
        }

        $this->table(['Code', 'Department', 'Name', 'HoD email', 'Action'], $rows);

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
