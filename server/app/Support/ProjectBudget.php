<?php

namespace App\Support;

/**
 * A project's budget: what is stored, what is derived, and how an old one is
 * read forward.
 *
 * Three heads are derived rather than typed in. Manpower is a list of lines,
 * each a category with a count and a per-head amount, and it contributes
 * count x amount — a count that did not multiply would be decoration.
 * Equipment and Any Other Expenses are free-form lists, so neither carries a
 * fixed menu of options. Travel, Contingency and Overhead are still typed
 * directly against the year, and Travel keeps its Domestic/International split.
 *
 * Reserved top-level keys hold the lists. Everything else in the object is a
 * year, which is why years() filters on the double underscore.
 */
final class ProjectBudget
{
    public const HEAD_MANPOWER = 'Manpower';
    public const HEAD_TRAVEL = 'Travel';
    public const HEAD_EQUIPMENT = 'Equipment';
    public const HEAD_CONTINGENCY = 'Contingency';
    public const HEAD_OVERHEAD = 'Overhead';
    public const HEAD_OTHER = 'Any Other Expenses';

    public const KEY_SUBITEMS = '__subitems';
    public const KEY_MANPOWER = '__manpower';
    public const KEY_EQUIPMENT = '__equipment';
    public const KEY_OTHER = '__other';

    /** Requirement 3: PhD Scholar is deliberately absent. */
    public const MANPOWER_CATEGORIES = ['Postdoc', 'JRF', 'SRF', 'UG Intern', 'PG Intern'];

    private const RESERVED = [self::KEY_SUBITEMS, self::KEY_MANPOWER, self::KEY_EQUIPMENT, self::KEY_OTHER];

    /**
     * The budget table, in display order.
     *
     * kind is what the UI renders: "amount" is a single number per year,
     * "subitems" is a number per year plus a fixed breakdown, and "lines" is
     * the add-your-own list.
     *
     * @return array<int, array{head: string, kind: string, subItems: array<int, string>}>
     */
    public static function heads(): array
    {
        return [
            ['head' => self::HEAD_MANPOWER, 'kind' => 'lines', 'subItems' => []],
            ['head' => self::HEAD_TRAVEL, 'kind' => 'subitems', 'subItems' => ['Domestic', 'International']],
            ['head' => self::HEAD_EQUIPMENT, 'kind' => 'lines', 'subItems' => []],
            ['head' => self::HEAD_CONTINGENCY, 'kind' => 'amount', 'subItems' => []],
            ['head' => self::HEAD_OVERHEAD, 'kind' => 'amount', 'subItems' => []],
            ['head' => self::HEAD_OTHER, 'kind' => 'lines', 'subItems' => []],
        ];
    }

    /** @return array<int, string> */
    public static function years(array $budget): array
    {
        return array_values(array_filter(
            array_keys($budget),
            fn ($k) => !in_array($k, self::RESERVED, true)
        ));
    }

    public static function headTotal(array $budget, string $year, string $head): int
    {
        return match ($head) {
            self::HEAD_MANPOWER => array_sum(array_map(
                fn ($l) => (int) ($l['count'] ?? 0) * (int) ($l['amount'] ?? 0),
                $budget[self::KEY_MANPOWER][$year] ?? []
            )),
            self::HEAD_EQUIPMENT => array_sum(array_map(
                fn ($l) => (int) ($l['amount'] ?? 0),
                $budget[self::KEY_EQUIPMENT][$year] ?? []
            )),
            self::HEAD_OTHER => array_sum(array_map(
                fn ($l) => (int) ($l['amount'] ?? 0),
                $budget[self::KEY_OTHER][$year] ?? []
            )),
            default => (int) ($budget[$year][$head] ?? 0),
        };
    }

    public static function yearTotal(array $budget, string $year): int
    {
        $total = 0;
        foreach (self::heads() as $h) {
            $total += self::headTotal($budget, $year, $h['head']);
        }

        return $total;
    }

    public static function grandTotal(array $budget): int
    {
        $total = 0;
        foreach (self::years($budget) as $year) {
            $total += self::yearTotal($budget, $year);
        }

        return $total;
    }

    /**
     * Read any stored budget — legacy or current — into the current shape.
     *
     * The rule for legacy data is that the money survives. A Manpower or
     * Equipment sub-item becomes a line of its own with its label intact, even
     * a label the menu no longer offers, so a proposal that budgeted for a PhD
     * Scholar still shows that amount against that word. A head amount with no
     * breakdown behind it becomes one unlabelled line, which keeps the year
     * total right and leaves an obvious blank for someone to fill in.
     */
    public static function normalize(mixed $raw): array
    {
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        if (!is_array($raw)) {
            return [];
        }

        $out = [
            self::KEY_SUBITEMS => [],
            self::KEY_MANPOWER => [],
            self::KEY_EQUIPMENT => [],
            self::KEY_OTHER => [],
        ];

        foreach (self::years($raw) as $year) {
            $stored = is_array($raw[$year] ?? null) ? $raw[$year] : [];
            $subs = $raw[self::KEY_SUBITEMS][$year] ?? [];
            $subs = is_array($subs) ? $subs : [];

            // Stored heads: everything that is not derived.
            $out[$year] = [];
            foreach ([self::HEAD_TRAVEL, self::HEAD_CONTINGENCY, self::HEAD_OVERHEAD] as $head) {
                if (isset($stored[$head])) {
                    $out[$year][$head] = (int) $stored[$head];
                }
            }

            if (isset($subs[self::HEAD_TRAVEL]) && is_array($subs[self::HEAD_TRAVEL])) {
                $out[self::KEY_SUBITEMS][$year][self::HEAD_TRAVEL] =
                    array_map('intval', $subs[self::HEAD_TRAVEL]);
            }

            $out[self::KEY_MANPOWER][$year] = self::manpowerLines($raw, $stored, $subs, $year);
            $out[self::KEY_EQUIPMENT][$year] = self::itemLines(
                $raw[self::KEY_EQUIPMENT][$year] ?? null,
                $subs[self::HEAD_EQUIPMENT] ?? null,
                $stored[self::HEAD_EQUIPMENT] ?? null,
                'item'
            );
            $out[self::KEY_OTHER][$year] = self::itemLines(
                $raw[self::KEY_OTHER][$year] ?? null,
                $subs[self::HEAD_OTHER] ?? null,
                $stored[self::HEAD_OTHER] ?? null,
                'label'
            );
        }

        return $out;
    }

    /** @return array<int, array{category: string, count: int, amount: int}> */
    private static function manpowerLines(array $raw, array $stored, array $subs, string $year): array
    {
        $current = $raw[self::KEY_MANPOWER][$year] ?? null;
        if (is_array($current) && $current !== []) {
            return array_values(array_map(fn ($l) => [
                'category' => trim((string) ($l['category'] ?? '')),
                'count' => max(0, (int) ($l['count'] ?? 0)),
                'amount' => max(0, (int) ($l['amount'] ?? 0)),
            ], $current));
        }

        $legacySubs = $subs[self::HEAD_MANPOWER] ?? null;
        if (is_array($legacySubs) && $legacySubs !== []) {
            $lines = [];
            foreach ($legacySubs as $category => $amount) {
                $lines[] = ['category' => (string) $category, 'count' => 1, 'amount' => (int) $amount];
            }

            return $lines;
        }

        $headAmount = (int) ($stored[self::HEAD_MANPOWER] ?? 0);

        return $headAmount > 0 ? [['category' => '', 'count' => 1, 'amount' => $headAmount]] : [];
    }

    /**
     * Equipment and Any Other Expenses share a shape; only the label key differs.
     *
     * @return array<int, array<string, int|string>>
     */
    private static function itemLines(mixed $current, mixed $legacySubs, mixed $headAmount, string $labelKey): array
    {
        if (is_array($current) && $current !== []) {
            return array_values(array_map(fn ($l) => [
                $labelKey => trim((string) ($l[$labelKey] ?? $l['item'] ?? $l['label'] ?? '')),
                'amount' => max(0, (int) ($l['amount'] ?? 0)),
            ], $current));
        }

        if (is_array($legacySubs) && $legacySubs !== []) {
            $lines = [];
            foreach ($legacySubs as $label => $amount) {
                $lines[] = [$labelKey => (string) $label, 'amount' => (int) $amount];
            }

            return $lines;
        }

        $amount = (int) ($headAmount ?? 0);

        return $amount > 0 ? [[$labelKey => '', 'amount' => $amount]] : [];
    }
}
