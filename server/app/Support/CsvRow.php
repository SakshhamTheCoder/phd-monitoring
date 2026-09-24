<?php

namespace App\Support;

/**
 * Reading a column out of an imported row by any of the names it goes by.
 *
 * The institute's spreadsheets use prose headers ("Registration Number", "Emp
 * id") while the portal's own templates use snake_case, and people keep saved
 * copies of both. Case, spaces and punctuation carry no meaning in a header, so
 * they are stripped before comparing, which also covers the misspellings the
 * source sheets ship with once the correct spelling is listed alongside. A
 * bracketed aside is an instruction to whoever fills the sheet, not part of
 * the column's name, so it is dropped first.
 *
 * The same reading the web's import dialog did (bulkImport/columns.js) before
 * the rows came to the server as the sheet has them.
 */
final class CsvRow
{
    /** A spreadsheet writes "nothing recorded" several ways; none is a value to import. */
    private const EMPTY_MARKERS = ['na', 'n/a', '#n/a', 'nil', 'none', '-', '--', '---'];

    /** The first of $aliases the row fills, trimmed, or '' when none does. */
    public static function column(array $row, string ...$aliases): string
    {
        $values = [];
        foreach ($row as $key => $value) {
            $value = trim((string) ($value ?? ''));
            $values[self::normalise($key)] = in_array(strtolower($value), self::EMPTY_MARKERS, true) ? '' : $value;
        }

        foreach ($aliases as $alias) {
            $value = $values[self::normalise($alias)] ?? '';
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private static function normalise(mixed $header): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower(preg_replace('/\([^)]*\)/', '', (string) $header)));
    }
}
