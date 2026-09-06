<?php

namespace App\Support;

/**
 * One name in, the two columns the schema wants out.
 *
 * The rule is that the last whitespace-separated word is the surname and
 * everything before it is the given name. That handles the honorifics and
 * multi-part given names the register actually contains — "Dr. Tarunpreet
 * Bhatia", "Maria del Carmen Rodriguez" — without pretending to parse names
 * properly, which no rule can do. A single-word name keeps the ' ' surname the
 * existing controllers already write, because users.last_name is not nullable
 * on every install.
 */
final class PersonName
{
    /** What the codebase already stores when there is no surname. */
    public const NO_SURNAME = ' ';

    /** @return array{first: string, last: string} */
    public static function split(?string $full): array
    {
        $normalized = trim(preg_replace('/\s+/u', ' ', (string) $full) ?? '');

        if ($normalized === '') {
            return ['first' => '', 'last' => self::NO_SURNAME];
        }

        $parts = explode(' ', $normalized);
        if (count($parts) === 1) {
            return ['first' => $parts[0], 'last' => self::NO_SURNAME];
        }

        $last = array_pop($parts);

        return ['first' => implode(' ', $parts), 'last' => $last];
    }

    public static function join(?string $first, ?string $last): string
    {
        return trim(trim((string) $first) . ' ' . trim((string) $last));
    }

    /**
     * Pull a name out of an import row.
     *
     * full_name is what every template now asks for; the legacy pair is still
     * read so a spreadsheet someone saved before the change keeps importing.
     * Neither is required here — the caller decides whether a nameless row is
     * an error, because for an update-by-email row it is not.
     *
     * @param array<string, mixed> $row
     * @return array{first: string, last: string}|null
     */
    public static function fromRow(array $row): ?array
    {
        foreach (['full_name', 'Full Name', 'fullname', 'name', 'Name'] as $key) {
            if (isset($row[$key]) && trim((string) $row[$key]) !== '') {
                return self::split((string) $row[$key]);
            }
        }

        foreach ([['first_name', 'last_name'], ['First Name', 'Last Name']] as [$firstKey, $lastKey]) {
            $first = trim((string) ($row[$firstKey] ?? ''));
            if ($first !== '') {
                $last = trim((string) ($row[$lastKey] ?? ''));

                return ['first' => $first, 'last' => $last !== '' ? $last : self::NO_SURNAME];
            }
        }

        return null;
    }
}
