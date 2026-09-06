<?php

namespace App\Support;

/**
 * A project's objectives, as a list of one-line statements.
 *
 * Objectives used to be {title, description} pairs. Nothing is thrown away when
 * one of those is read back: the two halves are folded into the single line the
 * portal now asks for, so an old proposal still reads correctly.
 */
final class ProjectObjectives
{
    /** @return array<int, string> */
    public static function normalize(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        if (!is_array($raw)) {
            return [];
        }

        $out = [];
        foreach ($raw as $entry) {
            $line = is_array($entry) ? self::foldLegacy($entry) : (is_scalar($entry) ? (string) $entry : '');
            $line = trim(preg_replace('/\s+/u', ' ', $line) ?? '');
            if ($line !== '') {
                $out[] = $line;
            }
        }

        return array_values($out);
    }

    /** @param array<string, mixed> $entry */
    private static function foldLegacy(array $entry): string
    {
        $title = trim((string) ($entry['title'] ?? ''));
        $description = trim((string) ($entry['description'] ?? ''));

        if ($title !== '' && $description !== '') {
            return $title . ': ' . $description;
        }

        return $title !== '' ? $title : $description;
    }
}
