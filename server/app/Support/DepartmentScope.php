<?php

namespace App\Support;

/**
 * Which departments a request is allowed to touch.
 *
 * $allowed is null for a user with no department restriction — an admin — and a
 * list of ids for anyone scoped, such as a clerk. The returned ids are null for
 * "every department", a list to restrict to, or an empty list with denied set,
 * which the caller must turn into a 403.
 *
 * Denying rather than quietly returning nothing matters: a clerk who edits the
 * department_id in a request should be told no, not handed a blank roster that
 * looks like an empty department.
 */
final class DepartmentScope
{
    /**
     * @param array<int, int>|null $allowed
     * @return array{ids: array<int, int>|null, denied: bool}
     */
    public static function resolve(?array $allowed, mixed $requested): array
    {
        $wants = ($requested === null || $requested === '') ? null : (int) $requested;

        if ($allowed === null) {
            return ['ids' => $wants === null ? null : [$wants], 'denied' => false];
        }

        if ($allowed === []) {
            return ['ids' => [], 'denied' => true];
        }

        if ($wants === null) {
            return ['ids' => array_values($allowed), 'denied' => false];
        }

        $ids = array_values(array_intersect($allowed, [$wants]));

        return ['ids' => $ids, 'denied' => $ids === []];
    }
}
