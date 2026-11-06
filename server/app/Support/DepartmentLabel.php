<?php

namespace App\Support;

/**
 * How a department is written wherever it is only displayed: by its code
 * (CSED), since the full title does not fit a table cell. A department with no
 * code falls back to its name so nothing reads blank.
 *
 * Pickers and the Departments page keep the full name; filters and searches
 * match either (see FilterLogicTrait).
 */
final class DepartmentLabel
{
    /** @param  \App\Models\Department|array<string, mixed>|object|null  $department */
    public static function of($department): ?string
    {
        if ($department === null) {
            return null;
        }
        $code = trim((string) (is_array($department) ? ($department['code'] ?? '') : ($department->code ?? '')));
        if ($code !== '') {
            return $code;
        }
        $name = trim((string) (is_array($department) ? ($department['name'] ?? '') : ($department->name ?? '')));

        return $name !== '' ? $name : null;
    }
}
