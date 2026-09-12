<?php

namespace App\Support;

use App\Models\Department;

/**
 * Department codes, and how to resolve one that arrives from a spreadsheet.
 *
 * The authority is the department officers sheet the institute maintains, which
 * is what `departments.csv` is filled from. It disagrees with the thapar.edu
 * subdomains for six departments: Mathematics is DOM though its HoD address is
 * still hsom@thapar.edu, and the same split applies to DEE, DPMS, DCBC, DHSS and
 * TSLAS. The address is not evidence of the code any more, so the sheet wins.
 *
 * Renaming them would normally break every saved CSV, since imports resolve a
 * department by code. LEGACY_ALIASES keeps those files working: an import that
 * still says SOM finds DOM. Nothing writes an old code back, so the aliases are
 * a read path only and can be dropped once no old spreadsheets remain.
 */
class DepartmentCodes
{
    /**
     * Superseded code => official code.
     *
     * Keys are compared upper case, so they are written that way. Several
     * departments carry two superseded codes, one from the original data load
     * and one from the subdomain rename that preceded the officers sheet, so
     * both are listed. The Dera Bassi entries also normalise the suffix, which
     * was stored three different ways (Derabassi, DeraBassi, Dera Bassi).
     */
    public const LEGACY_ALIASES = [
        'DBT'  => 'BTD',
        'DCB'  => 'DCBC',
        'SCBC' => 'DCBC',
        'SOM'  => 'DOM',
        'SEE'  => 'DEE',
        'SPMS' => 'DPMS',
        'SHSS' => 'DHSS',
        'SMSS' => 'DHSS',
        'SLAS' => 'TSLAS',
        'DSAI' => 'CoE-DSAI',

        // The Dera Bassi campus departments keep the codes they already have.
        // They are not in the officers sheet, so nothing renames them.
        'DCB (DERABASSI)'   => 'SCBC (Derabassi)',
        'DOM (DERABASSI)'   => 'SOM (Derabassi)',
        'DPMS (DERABASSI)'  => 'SPMS (Derabassi)',
        'EIED (DERA BASSI)' => 'EIED (Derabassi)',
    ];

    /**
     * Find a department by code, accepting a superseded code.
     *
     * Matching is case insensitive because codes are typed by hand into
     * spreadsheets. Never creates anything: an unknown code is the caller's
     * problem to report, not something to invent a department for.
     */
    public static function resolve(?string $code): ?Department
    {
        $code = trim((string) $code);
        if ($code === '') {
            return null;
        }

        $department = Department::whereRaw('UPPER(code) = ?', [strtoupper($code)])->first();
        if ($department) {
            return $department;
        }

        $official = self::LEGACY_ALIASES[strtoupper($code)] ?? null;
        if (!$official) {
            return null;
        }

        return Department::whereRaw('UPPER(code) = ?', [strtoupper($official)])->first();
    }

    /**
     * Find the department that an official code refers to, whether or not it has
     * been renamed yet.
     *
     * resolve() goes the other way, superseded code to department, which is what
     * an import needs. This is the reverse: given DOM, it also finds a department
     * still stored as SOM. That is what lets the sync command run before and
     * after the rename with the same result.
     *
     * A code with more than one superseded spelling is tried against each, since
     * only one of them can be in the database at a time.
     */
    public static function resolveOfficial(string $officialCode): ?Department
    {
        $department = Department::whereRaw('UPPER(code) = ?', [strtoupper($officialCode)])->first();
        if ($department) {
            return $department;
        }

        foreach (self::LEGACY_ALIASES as $legacy => $official) {
            if (strtoupper($official) !== strtoupper($officialCode)) {
                continue;
            }

            $department = Department::whereRaw('UPPER(code) = ?', [$legacy])->first();
            if ($department) {
                return $department;
            }
        }

        return null;
    }

    /**
     * Codes an operator may legitimately use, for error messages.
     *
     * @return array<int, string>
     */
    public static function known(): array
    {
        return Department::orderBy('code')->pluck('code')->all();
    }
}
