<?php

namespace App\Support;

/**
 * A project's budget: what is stored, what is derived, and how an old one is
 * read forward.
 *
 * Manpower is a fixed category list, Equipment and Other Expenses are
 * free-form lists, and any of the three may instead carry a head total typed
 * by hand (__headamt), which overrides its breakdown. Reserved __keys hold the
 * lists; everything else is a year.
 *
 * Migration invariant: a legacy year's total is the sum of plain values in
 * budget[year]. normalize() reproduces that exact total: a stored head amount
 * wins over its breakdown, the gap carried as a visible reconciling line.
 */
final class ProjectBudget
{
    public const HEAD_MANPOWER = 'Manpower';
    public const HEAD_TRAVEL = 'Travel';
    public const HEAD_EQUIPMENT = 'Equipment';
    public const HEAD_CONSUMABLES = 'Consumables';
    public const HEAD_CONTINGENCY = 'Contingency';
    public const HEAD_OVERHEAD = 'Overhead';
    public const HEAD_OTHER = 'Other Expenses';
    /**
     * What this head was called before. A legacy budget stores its amount under
     * budget[year]['Other Expenses'] and its breakdown under the same key in
     * __subitems, so every read has to keep answering to the old wording or that
     * money detaches from the head and shows up as a stray legacy row.
     */
    public const HEAD_OTHER_LEGACY = 'Any Other Expenses';

    public const KEY_SUBITEMS = '__subitems';
    public const KEY_MANPOWER = '__manpower';
    public const KEY_EQUIPMENT = '__equipment';
    public const KEY_OTHER = '__other';
    /**
     * A head total typed directly against Manpower/Equipment/Other Expenses.
     * Deliberately NOT stored as budget[year][head]: that slot means "the legacy
     * total this head's breakdown must reconcile to" (see authoritativeFor()),
     * and reusing it would make every hand-typed total inject a reconciling
     * line. Kept apart, a typed total simply overrides the line sum and legacy
     * reads are left exactly as they were.
     */
    public const KEY_HEADAMT = '__headamt';

    /** Requirement 3: PhD Scholar is deliberately absent. */
    public const MANPOWER_CATEGORIES = ['Postdoc', 'JRF', 'SRF', 'UG Intern', 'PG Intern'];

    private const RESERVED = [self::KEY_SUBITEMS, self::KEY_MANPOWER, self::KEY_EQUIPMENT, self::KEY_OTHER, self::KEY_HEADAMT];

    /** The three heads that are computed from a line list, never stored against a year directly. */
    private const DERIVED_HEADS = [self::HEAD_MANPOWER, self::HEAD_EQUIPMENT, self::HEAD_OTHER];

    /** Derived heads plus the wording Other Expenses used to carry. */
    private static function isDerivedHead(string $head): bool
    {
        return in_array($head, self::DERIVED_HEADS, true) || $head === self::HEAD_OTHER_LEGACY;
    }

    /**
     * Fold a legacy head key onto the name it has now, so a budget written under
     * the old wording keeps its amount attached to the head instead of surfacing
     * as an unrecognised leftover row.
     *
     * @param array<string, mixed> $byHead
     * @return array<string, mixed>
     */
    private static function canonicalizeHeads(array $byHead): array
    {
        if (array_key_exists(self::HEAD_OTHER_LEGACY, $byHead)) {
            if (!array_key_exists(self::HEAD_OTHER, $byHead)) {
                $byHead[self::HEAD_OTHER] = $byHead[self::HEAD_OTHER_LEGACY];
            }
            unset($byHead[self::HEAD_OTHER_LEGACY]);
        }

        return $byHead;
    }

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
            ['head' => self::HEAD_CONSUMABLES, 'kind' => 'amount', 'subItems' => []],
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

    /**
     * A head total typed by hand, or null when the head has none and its lines
     * are the source of truth. Only ever set for the derived heads.
     */
    public static function typedHeadAmount(array $budget, string $year, string $head): ?int
    {
        $typed = $budget[self::KEY_HEADAMT][$year][$head] ?? null;
        if ($typed === null || $typed === '') {
            return null;
        }
        $number = self::toNumber($typed);

        return $number === null ? null : self::toInt($number);
    }

    public static function headTotal(array $budget, string $year, string $head): int
    {
        // Answer to the old wording too, so a caller holding a legacy head name
        // still resolves to the head that absorbed it.
        if ($head === self::HEAD_OTHER_LEGACY) {
            $head = self::HEAD_OTHER;
        }

        if (in_array($head, self::DERIVED_HEADS, true)) {
            $typed = self::typedHeadAmount($budget, $year, $head);
            if ($typed !== null) {
                return $typed;
            }
        }

        return match ($head) {
            self::HEAD_MANPOWER => self::sumManpowerLines($budget[self::KEY_MANPOWER][$year] ?? null),
            self::HEAD_EQUIPMENT => self::sumAmountLines($budget[self::KEY_EQUIPMENT][$year] ?? null),
            self::HEAD_OTHER => self::sumTopLevelAmountLines($budget[self::KEY_OTHER][$year] ?? null),
            default => self::toInt(self::toNumber(
                is_array($budget[$year] ?? null) ? ($budget[$year][$head] ?? 0) : 0
            ) ?? 0.0),
        };
    }

    /**
     * A year's total is the three derived heads plus every plain value sitting
     * under budget[year] — not just the six heads the UI currently offers.
     * That second half is what lets a legacy head the current menu no longer
     * shows keep counting after migration instead of silently vanishing from
     * the total while still sitting in the data.
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
                if (self::isDerivedHead($head)) {
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
            self::KEY_HEADAMT => [],
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
            $stored = self::canonicalizeHeads($stored);
            $subs = $raw[self::KEY_SUBITEMS][$year] ?? [];
            $subs = self::canonicalizeHeads(is_array($subs) ? $subs : []);

            // Stored heads: every plain value that isn't one of the three
            // derived ones, known to the current menu or not.
            $out[$year] = [];
            foreach ($stored as $head => $value) {
                if (self::isDerivedHead($head)) {
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

            // Hand-typed head totals, kept only for the heads that can have one
            // and only when a real number was entered — a blank clears back to
            // "the breakdown is the total".
            $typed = $raw[self::KEY_HEADAMT][$year] ?? null;
            if (is_array($typed)) {
                foreach (self::DERIVED_HEADS as $derived) {
                    $value = $typed[$derived] ?? null;
                    if ($value === null || $value === '') {
                        continue;
                    }
                    $number = self::toNumber($value);
                    if ($number !== null) {
                        $out[self::KEY_HEADAMT][$year][$derived] = self::toInt($number);
                    }
                }
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
                'label',
                true
            );
        }

        return $out;
    }

    /** @return array<int, array{category: string, amount: int}> */
    private static function normalizeManpower(array $raw, array $stored, array $subs, string $year, bool $isLegacyRow): array
    {
        $current = $raw[self::KEY_MANPOWER][$year] ?? null;
        $usingCurrent = is_array($current) && $current !== [];

        $lines = self::manpowerLines($current, $subs[self::HEAD_MANPOWER] ?? null);
        $authoritative = self::authoritativeFor($stored, $isLegacyRow, $usingCurrent, self::HEAD_MANPOWER);

        return self::reconcile(
            $lines,
            $authoritative,
            fn ($l) => $l['amount'],
            fn ($amount) => ['category' => '', 'amount' => $amount],
            fn ($amount) => ['category' => self::RECONCILE_LABEL, 'amount' => $amount]
        );
    }

    /** @return array<int, array{category: string, amount: int}> */
    private static function manpowerLines(mixed $current, mixed $legacySubs): array
    {
        if (is_array($current) && $current !== []) {
            return array_values(array_map(function ($l) {
                $l = is_array($l) ? $l : [];

                $amount = self::toInt(self::toNumber($l['amount'] ?? null) ?? 0.0);
                // Legacy lines costed count x amount. Fold the multiplier in so a
                // migrated row keeps the exact total it had before count was dropped.
                if (array_key_exists('count', $l)) {
                    $count = self::toInt(self::toNumber($l['count'] ?? null) ?? 0.0);
                    $amount *= $count;
                }

                return [
                    'category' => trim((string) ($l['category'] ?? '')),
                    'amount' => $amount,
                ];
            }, $current));
        }

        if (is_array($legacySubs) && $legacySubs !== []) {
            $lines = [];
            foreach ($legacySubs as $category => $amount) {
                $lines[] = [
                    'category' => (string) $category,
                    'amount' => self::toInt(self::toNumber($amount) ?? 0.0),
                ];
            }

            return $lines;
        }

        return [];
    }

    /**
     * Equipment and Other Expenses share a shape and the same
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
        string $labelKey,
        bool $keepParent = false
    ): array {
        $usingCurrent = is_array($current) && $current !== [];
        $lines = self::itemLines($current, $legacySubs, $labelKey, $keepParent);
        $authoritative = self::authoritativeFor($stored, $isLegacyRow, $usingCurrent, $head);

        return self::reconcile(
            $lines,
            $authoritative,
            fn ($l) => $l['amount'],
            fn ($amount) => $keepParent
                ? [$labelKey => '', 'amount' => $amount, 'parent' => '']
                : [$labelKey => '', 'amount' => $amount],
            fn ($amount) => $keepParent
                ? [$labelKey => self::RECONCILE_LABEL, 'amount' => $amount, 'parent' => '']
                : [$labelKey => self::RECONCILE_LABEL, 'amount' => $amount]
        );
    }

    /** @return array<int, array<string, int|string>> */
    private static function itemLines(mixed $current, mixed $legacySubs, string $labelKey, bool $keepParent = false): array
    {
        if (is_array($current) && $current !== []) {
            return array_values(array_map(function ($l) use ($labelKey, $keepParent) {
                $l = is_array($l) ? $l : [];
                $line = [
                    $labelKey => trim((string) ($l[$labelKey] ?? $l['item'] ?? $l['label'] ?? '')),
                    'amount' => self::toInt(self::toNumber($l['amount'] ?? null) ?? 0.0),
                ];
                // The row's identity, so two blank rows stay two rows.
                $id = trim((string) ($l['id'] ?? ''));
                if ($id !== '') {
                    $line['id'] = $id;
                }
                // An empty parent is a top-level row; legacy rows have none at all.
                if ($keepParent) {
                    $line['parent'] = trim((string) ($l['parent'] ?? ''));
                }

                return $line;
            }, $current));
        }

        if (is_array($legacySubs) && $legacySubs !== []) {
            $lines = [];
            foreach ($legacySubs as $label => $amount) {
                $line = [$labelKey => (string) $label, 'amount' => self::toInt(self::toNumber($amount) ?? 0.0)];
                if ($keepParent) {
                    $line['parent'] = '';
                }
                $lines[] = $line;
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
            $amount = self::toInt(self::toNumber($line['amount'] ?? null) ?? 0.0);
            // A row written before count was dropped still costs count x amount.
            if (array_key_exists('count', $line)) {
                $amount *= self::toInt(self::toNumber($line['count'] ?? null) ?? 0.0);
            }
            $sum += $amount;
        }

        return $sum;
    }

    /**
     * Other Expenses only: a sub-row breaks its parent row down, so counting
     * both would bill the same money twice. Top-level rows carry the head.
     */
    private static function sumTopLevelAmountLines(mixed $lines): int
    {
        if (!is_array($lines)) {
            return 0;
        }

        $sum = 0;
        foreach ($lines as $line) {
            if (!is_array($line) || trim((string) ($line['parent'] ?? '')) !== '') {
                continue;
            }
            $sum += self::toInt(self::toNumber($line['amount'] ?? null) ?? 0.0);
        }

        return $sum;
    }

    /** An item line list (Equipment), guarded the same way. */
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
