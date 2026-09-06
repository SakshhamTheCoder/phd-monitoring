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
 *
 * The migration invariant. The old portal's total for a year was, and still
 * is, the sum of the plain values sitting in budget[year] — that is what
 * cellMismatch/budgetMismatches in the old UI warns about when a head and its
 * sub-item breakdown disagree. normalize() must reproduce that exact total
 * for any year that already existed under that legacy reading, even when the
 * row is malformed, because a migration that quietly moves money is worse
 * than one that refuses to run. Two consequences follow:
 *
 *  - When a derived head (Manpower/Equipment/Any Other Expenses) has both a
 *    stored head amount and a line/sub-item breakdown that doesn't sum to it,
 *    the stored amount wins — it is what the old total already counted — and
 *    the gap is carried forward as its own visible line rather than silently
 *    dropped or invented.
 *  - A year that only exists via __manpower/__equipment/__other/__subitems
 *    (no legacy row at all, e.g. a year created directly in the new shape) is
 *    not constrained by that old total, so its lines are trusted as-is; there
 *    is nothing on the old side for them to disagree with.
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

    /** The three heads that are computed from a line list, never stored against a year directly. */
    private const DERIVED_HEADS = [self::HEAD_MANPOWER, self::HEAD_EQUIPMENT, self::HEAD_OTHER];

    /**
     * Label for the synthetic line normalize() adds when a legacy head amount
     * disagrees with its own breakdown. It is deliberately visible rather
     * than a silent adjustment: someone reading the migrated budget should be
     * able to see that the old row didn't add up, not just see a total that
     * happens to still be right.
     */
    private const RECONCILE_LABEL = 'Unallocated (legacy total)';

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

    /**
     * Every year the budget mentions, whether that's a plain top-level row or
     * a year that only shows up inside one of the reserved line lists (a year
     * created directly in the new shape has no top-level row at all — that's
     * the point of the derived heads never being stored there).
     *
     * @return array<int, string>
     */
    public static function years(array $budget): array
    {
        $years = array_values(array_filter(
            array_keys($budget),
            fn ($k) => !in_array($k, self::RESERVED, true)
        ));

        foreach (self::RESERVED as $reservedKey) {
            $bucket = $budget[$reservedKey] ?? null;
            if (!is_array($bucket)) {
                continue;
            }
            foreach (array_keys($bucket) as $year) {
                if (!in_array($year, $years, true)) {
                    $years[] = $year;
                }
            }
        }

        return $years;
    }

    public static function headTotal(array $budget, string $year, string $head): int
    {
        return match ($head) {
            self::HEAD_MANPOWER => self::sumManpowerLines($budget[self::KEY_MANPOWER][$year] ?? null),
            self::HEAD_EQUIPMENT => self::sumAmountLines($budget[self::KEY_EQUIPMENT][$year] ?? null),
            self::HEAD_OTHER => self::sumAmountLines($budget[self::KEY_OTHER][$year] ?? null),
            default => self::toInt(self::toNumber(
                is_array($budget[$year] ?? null) ? ($budget[$year][$head] ?? 0) : 0
            ) ?? 0.0),
        };
    }

    /**
     * A year's total is the three derived heads plus every plain value sitting
     * under budget[year] — not just the six heads the UI currently offers.
     * That second half is what lets a legacy head the current menu no longer
     * shows (Consumables, say) keep counting after migration instead of
     * silently vanishing from the total while still sitting in the data.
     */
    public static function yearTotal(array $budget, string $year): int
    {
        $total = 0;
        foreach (self::DERIVED_HEADS as $head) {
            $total += self::headTotal($budget, $year, $head);
        }

        $stored = $budget[$year] ?? [];
        if (is_array($stored)) {
            foreach ($stored as $head => $value) {
                if (in_array($head, self::DERIVED_HEADS, true)) {
                    continue; // never true after normalize(), but headTotal() already covers these two ways
                }
                $total += self::toInt(self::toNumber($value) ?? 0.0);
            }
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
     * The rule for legacy data is that the money survives, and that it
     * survives at the exact total the old portal already showed for that
     * year (see the class docblock). A Manpower or Equipment sub-item becomes
     * a line of its own with its label intact, even a label the menu no
     * longer offers, so a proposal that budgeted for a PhD Scholar still
     * shows that amount against that word. A head amount with no breakdown
     * behind it becomes one unlabelled line. A head amount that disagrees
     * with its own breakdown keeps the breakdown and adds a labelled
     * reconciling line rather than picking a number that changes the total.
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

        // A year only counts as a legacy row — subject to the "total must
        // match" rule — if it actually had a top-level entry in the input.
        // A year that exists solely via __manpower/__subitems/etc. was never
        // read by the old total in the first place, so there's nothing for
        // its lines to be reconciled against.
        $legacyYears = array_flip(array_filter(
            array_keys($raw),
            fn ($k) => !in_array($k, self::RESERVED, true)
        ));

        foreach (self::years($raw) as $year) {
            $isLegacyRow = array_key_exists($year, $legacyYears);
            $stored = ($isLegacyRow && is_array($raw[$year] ?? null)) ? $raw[$year] : [];
            $subs = $raw[self::KEY_SUBITEMS][$year] ?? [];
            $subs = is_array($subs) ? $subs : [];

            // Stored heads: every plain value that isn't one of the three
            // derived ones, known to the current menu or not.
            $out[$year] = [];
            foreach ($stored as $head => $value) {
                if (in_array($head, self::DERIVED_HEADS, true)) {
                    continue;
                }
                $number = self::toNumber($value);
                if ($number !== null) {
                    $out[$year][$head] = self::toInt($number);
                }
            }

            if (isset($subs[self::HEAD_TRAVEL]) && is_array($subs[self::HEAD_TRAVEL])) {
                $out[self::KEY_SUBITEMS][$year][self::HEAD_TRAVEL] = array_map(
                    fn ($v) => self::toInt(self::toNumber($v) ?? 0.0),
                    $subs[self::HEAD_TRAVEL]
                );
            }

            $out[self::KEY_MANPOWER][$year] = self::normalizeManpower($raw, $stored, $subs, $year, $isLegacyRow);
            $out[self::KEY_EQUIPMENT][$year] = self::normalizeItems(
                $raw[self::KEY_EQUIPMENT][$year] ?? null,
                $subs[self::HEAD_EQUIPMENT] ?? null,
                $stored,
                self::HEAD_EQUIPMENT,
                $isLegacyRow,
                'item'
            );
            $out[self::KEY_OTHER][$year] = self::normalizeItems(
                $raw[self::KEY_OTHER][$year] ?? null,
                $subs[self::HEAD_OTHER] ?? null,
                $stored,
                self::HEAD_OTHER,
                $isLegacyRow,
                'label'
            );
        }

        return $out;
    }

    /** @return array<int, array{category: string, count: int, amount: int}> */
    private static function normalizeManpower(array $raw, array $stored, array $subs, string $year, bool $isLegacyRow): array
    {
        $current = $raw[self::KEY_MANPOWER][$year] ?? null;
        $usingCurrent = is_array($current) && $current !== [];

        $lines = self::manpowerLines($current, $subs[self::HEAD_MANPOWER] ?? null);
        $authoritative = self::authoritativeFor($stored, $isLegacyRow, $usingCurrent, self::HEAD_MANPOWER);

        return self::reconcile(
            $lines,
            $authoritative,
            fn ($l) => $l['count'] * $l['amount'],
            fn ($amount) => ['category' => '', 'count' => 1, 'amount' => $amount],
            fn ($amount) => ['category' => self::RECONCILE_LABEL, 'count' => 1, 'amount' => $amount]
        );
    }

    /** @return array<int, array{category: string, count: int, amount: int}> */
    private static function manpowerLines(mixed $current, mixed $legacySubs): array
    {
        if (is_array($current) && $current !== []) {
            return array_values(array_map(function ($l) {
                $l = is_array($l) ? $l : [];

                return [
                    'category' => trim((string) ($l['category'] ?? '')),
                    'count' => self::toInt(self::toNumber($l['count'] ?? null) ?? 0.0),
                    'amount' => self::toInt(self::toNumber($l['amount'] ?? null) ?? 0.0),
                ];
            }, $current));
        }

        if (is_array($legacySubs) && $legacySubs !== []) {
            $lines = [];
            foreach ($legacySubs as $category => $amount) {
                $lines[] = [
                    'category' => (string) $category,
                    'count' => 1,
                    'amount' => self::toInt(self::toNumber($amount) ?? 0.0),
                ];
            }

            return $lines;
        }

        return [];
    }

    /**
     * Equipment and Any Other Expenses share a shape and the same
     * head-vs-breakdown reconciliation as Manpower; only the label key
     * ("item" or "label") and which head is being read differ.
     *
     * @return array<int, array<string, int|string>>
     */
    private static function normalizeItems(
        mixed $current,
        mixed $legacySubs,
        array $stored,
        string $head,
        bool $isLegacyRow,
        string $labelKey
    ): array {
        $usingCurrent = is_array($current) && $current !== [];
        $lines = self::itemLines($current, $legacySubs, $labelKey);
        $authoritative = self::authoritativeFor($stored, $isLegacyRow, $usingCurrent, $head);

        return self::reconcile(
            $lines,
            $authoritative,
            fn ($l) => $l['amount'],
            fn ($amount) => [$labelKey => '', 'amount' => $amount],
            fn ($amount) => [$labelKey => self::RECONCILE_LABEL, 'amount' => $amount]
        );
    }

    /** @return array<int, array<string, int|string>> */
    private static function itemLines(mixed $current, mixed $legacySubs, string $labelKey): array
    {
        if (is_array($current) && $current !== []) {
            return array_values(array_map(function ($l) use ($labelKey) {
                $l = is_array($l) ? $l : [];

                return [
                    $labelKey => trim((string) ($l[$labelKey] ?? $l['item'] ?? $l['label'] ?? '')),
                    'amount' => self::toInt(self::toNumber($l['amount'] ?? null) ?? 0.0),
                ];
            }, $current));
        }

        if (is_array($legacySubs) && $legacySubs !== []) {
            $lines = [];
            foreach ($legacySubs as $label => $amount) {
                $lines[] = [$labelKey => (string) $label, 'amount' => self::toInt(self::toNumber($amount) ?? 0.0)];
            }

            return $lines;
        }

        return [];
    }

    /**
     * The number a derived head's lines must add up to, or null if nothing
     * constrains them.
     *
     * A stored amount for the head, if the input actually has one, always
     * wins — it's what the old total already counted. Failing that: if we're
     * reading the new shape's own lines (no stored amount alongside them),
     * they're the source of truth and nothing reconciles them. Only when
     * there's no head amount, no current-shape lines, and the year did exist
     * as a legacy row do we treat the head as an explicit zero — that's the
     * case of sub-items recorded without a matching head total, which the old
     * portal's own total never counted either.
     */
    private static function authoritativeFor(array $stored, bool $isLegacyRow, bool $usingCurrentLines, string $head): ?int
    {
        if (isset($stored[$head])) {
            return self::toInt(self::toNumber($stored[$head]) ?? 0.0);
        }

        if ($usingCurrentLines) {
            return null;
        }

        return $isLegacyRow ? 0 : null;
    }

    /**
     * Make a derived head's lines add up to $authoritative, when there is one
     * to match. An empty line list with a nonzero authoritative amount
     * becomes a single unlabelled line (nothing to break down further). A
     * non-empty line list that already matches is left untouched. A
     * non-empty line list that disagrees keeps every original line and gets
     * one extra, visibly labelled line carrying the gap — which can be
     * negative, when the breakdown overshoots the stored total.
     *
     * @param array<int, array<string, int|string>> $lines
     */
    private static function reconcile(
        array $lines,
        ?int $authoritative,
        callable $lineValue,
        callable $makeUnlabelledLine,
        callable $makeReconcileLine
    ): array {
        if ($authoritative === null) {
            return $lines;
        }

        $wasEmpty = $lines === [];
        $sum = array_sum(array_map($lineValue, $lines));
        $delta = $authoritative - $sum;

        if ($delta === 0) {
            return $lines;
        }

        $lines[] = $wasEmpty ? $makeUnlabelledLine($delta) : $makeReconcileLine($delta);

        return $lines;
    }

    /** A manpower line list, guarded against a malformed (non-array) value so a bad row can't crash a read. */
    private static function sumManpowerLines(mixed $lines): int
    {
        if (!is_array($lines)) {
            return 0;
        }

        $sum = 0;
        foreach ($lines as $line) {
            if (!is_array($line)) {
                continue;
            }
            $count = self::toInt(self::toNumber($line['count'] ?? null) ?? 0.0);
            $amount = self::toInt(self::toNumber($line['amount'] ?? null) ?? 0.0);
            $sum += $count * $amount;
        }

        return $sum;
    }

    /** An item/label line list (Equipment, Any Other Expenses), guarded the same way. */
    private static function sumAmountLines(mixed $lines): int
    {
        if (!is_array($lines)) {
            return 0;
        }

        $sum = 0;
        foreach ($lines as $line) {
            if (!is_array($line)) {
                continue;
            }
            $sum += self::toInt(self::toNumber($line['amount'] ?? null) ?? 0.0);
        }

        return $sum;
    }

    /** A value as a number, or null if it isn't one — the guard that keeps junk input from crashing a read. */
    private static function toNumber(mixed $v): ?float
    {
        if (is_int($v) || is_float($v)) {
            return (float) $v;
        }
        if (is_string($v) && is_numeric($v)) {
            return (float) $v;
        }

        return null;
    }

    /**
     * Round to the nearest rupee rather than truncate. Every figure passes
     * through this exactly once, at the point it's stored — truncating (or
     * rounding) the same figure more than once as it moves through a read
     * path is what turns a small, unbiased rounding gap into a total that
     * drifts downward every time the budget is read.
     */
    private static function toInt(float $v): int
    {
        return (int) round($v);
    }
}
