<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

/**
 * Moving a faculty's employee code to the number the institute now uses.
 *
 * Nineteen columns reference faculty.faculty_code and follow it on their own,
 * because the keys carry ON UPDATE CASCADE. These do not: a form that stores
 * its supervisors as a list of codes, and a change request that keeps the old
 * and new code as plain fields. A stale code in either shows up as a form that
 * cannot draw its own supervisors, so they are rewritten here.
 */
class FacultyCode
{
    /** Columns holding a JSON list of codes and nothing else. */
    private const CODE_LISTS = [
        'supervisor_allocation_form' => ['prefrences', 'supervisors'],
        'supervisor_change_forms' => ['to_change', 'prefrences', 'current_supervisors', 'new_supervisors'],
    ];

    /** Columns holding one code, with no key on them. */
    private const SINGLE_CODES = [
        'supervisor_doctoral_changes' => ['old_faculty_code', 'new_faculty_code'],
    ];

    /** A project's own record of its co-PIs, a list of objects. project_co_pis is the keyed index. */
    private const CODE_OBJECT_LISTS = [
        'projects' => ['co_pis' => 'faculty_code'],
    ];

    /** Returns how many rows were rewritten, for the import to report. */
    public static function retag(int $from, int $to): int
    {
        if ($from === $to) return 0;

        $rewritten = 0;

        foreach (self::CODE_LISTS as $table => $columns) {
            foreach ($columns as $column) {
                $rewritten += self::rewrite($table, $column, $from, fn ($codes) => array_map(
                    fn ($code) => (int) $code === $from ? $to : $code,
                    $codes
                ));
            }
        }

        foreach (self::CODE_OBJECT_LISTS as $table => $columns) {
            foreach ($columns as $column => $key) {
                $rewritten += self::rewrite($table, $column, $from, fn ($members) => array_map(
                    function ($member) use ($key, $from, $to) {
                        if (is_array($member) && isset($member[$key]) && (int) $member[$key] === $from) {
                            $member[$key] = $to;
                        }
                        return $member;
                    },
                    $members
                ));
            }
        }

        foreach (self::SINGLE_CODES as $table => $columns) {
            foreach ($columns as $column) {
                $rewritten += DB::table($table)->where($column, (string) $from)->update([$column => (string) $to]);
            }
        }

        return $rewritten;
    }

    /**
     * Reads the rows whose text mentions the old code at all, hands the
     * decoded list to the caller, and writes back only what actually changed.
     * The LIKE is a cheap sieve that can over-match, such as 61000823 holding
     * 1000823; the comparison in PHP decides, because the code is stored
     * sometimes as a number and sometimes as a string.
     */
    private static function rewrite(string $table, string $column, int $from, callable $replace): int
    {
        $rows = DB::table($table)
            ->select('id', $column)
            ->where($column, 'like', '%' . $from . '%')
            ->get();

        $rewritten = 0;
        foreach ($rows as $row) {
            $stored = $row->{$column};
            if (!is_string($stored) || $stored === '') continue;

            $decoded = json_decode($stored, true);
            if (!is_array($decoded)) continue;

            $replaced = $replace($decoded);
            if ($replaced === $decoded) continue;

            DB::table($table)->where('id', $row->id)->update([$column => json_encode($replaced)]);
            $rewritten++;
        }

        return $rewritten;
    }
}
