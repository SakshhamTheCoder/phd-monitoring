<?php

namespace App\Support;

use App\Models\Department;

/**
 * Department codes, and how to resolve one that arrives from a spreadsheet.
 *
 * Six departments were stored under a code that was not the institute's own
 * abbreviation. The official one is the department's subdomain on thapar.edu,
 * which is also what the HoD address is built from: som.thapar.edu gives both
 * the code SOM and the address hsom@thapar.edu.
 *
 * Renaming them would normally break every saved CSV, since imports resolve a
 * department by code. LEGACY_ALIASES keeps those files working: an import that
 * still says DOM finds SOM. Nothing writes an old code back, so the aliases are
 * a read path only and can be dropped once no old spreadsheets remain.
 */
class DepartmentCodes
{
    /**
     * Superseded code => official code.
     */
    public const LEGACY_ALIASES = [
        'DBT'  => 'BTD',
        'DCB'  => 'SCBC',
        'DOM'  => 'SOM',
        'DEE'  => 'SEE',
        'DPMS' => 'SPMS',
        'SHSS' => 'SMSS',
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
     * an import needs. This is the reverse: given BTD, it also finds a department
     * still stored as DBT. That is what lets the sync command run before and
     * after the rename with the same result.
     */
    public static function resolveOfficial(string $officialCode): ?Department
    {
        $department = Department::whereRaw('UPPER(code) = ?', [strtoupper($officialCode)])->first();
        if ($department) {
            return $department;
        }

        $legacy = array_search(strtoupper($officialCode), self::LEGACY_ALIASES, true);
        if ($legacy === false) {
            return null;
        }

        return Department::whereRaw('UPPER(code) = ?', [strtoupper($legacy)])->first();
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
