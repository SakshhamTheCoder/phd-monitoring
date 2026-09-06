<?php

namespace Tests\Unit\Support;

use App\Support\ProjectBudget;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProjectBudgetTest extends TestCase
{
    private function sample(): array
    {
        return [
            'year1' => ['Travel' => 120000, 'Contingency' => 50000, 'Overhead' => 20000],
            '__subitems' => ['year1' => ['Travel' => ['Domestic' => 80000, 'International' => 40000]]],
            '__manpower' => ['year1' => [
                ['category' => 'Postdoc', 'count' => 2, 'amount' => 50000],
                ['category' => 'JRF', 'count' => 3, 'amount' => 31000],
            ]],
            '__equipment' => ['year1' => [
                ['item' => 'GPU Workstation', 'amount' => 250000],
                ['item' => 'Sensor Array', 'amount' => 75000],
            ]],
            '__other' => ['year1' => [['label' => 'Publication charges', 'amount' => 30000]]],
        ];
    }

    public function test_manpower_multiplies_count_by_amount(): void
    {
        // 2 x 50000 + 3 x 31000 = 193000
        $this->assertSame(193000, ProjectBudget::headTotal($this->sample(), 'year1', 'Manpower'));
    }

    public function test_a_manpower_count_of_zero_contributes_nothing(): void
    {
        // A fixture with a real fixture, per code review: __manpower alone (no top-level
        // year1) still yields a year, per the years() fix for orphan __manpower rows —
        // and the count genuinely has to multiply, not merely exist, to pass this.
        $b = ['__manpower' => ['year1' => [['category' => 'Postdoc', 'count' => 0, 'amount' => 50000]]]];
        $this->assertSame(0, ProjectBudget::headTotal(ProjectBudget::normalize($b), 'year1', 'Manpower'));

        $b['__manpower']['year1'][0]['count'] = 1;
        $this->assertSame(50000, ProjectBudget::headTotal(ProjectBudget::normalize($b), 'year1', 'Manpower'));

        $b['__manpower']['year1'][0]['count'] = 2;
        $this->assertSame(100000, ProjectBudget::headTotal(ProjectBudget::normalize($b), 'year1', 'Manpower'));
    }

    public function test_equipment_sums_free_form_items(): void
    {
        $this->assertSame(325000, ProjectBudget::headTotal($this->sample(), 'year1', 'Equipment'));
    }

    public function test_any_other_expenses_is_its_own_head(): void
    {
        $this->assertSame(30000, ProjectBudget::headTotal($this->sample(), 'year1', 'Any Other Expenses'));
    }

    public function test_stored_heads_are_read_straight_through(): void
    {
        $this->assertSame(120000, ProjectBudget::headTotal($this->sample(), 'year1', 'Travel'));
        $this->assertSame(50000, ProjectBudget::headTotal($this->sample(), 'year1', 'Contingency'));
    }

    public function test_year_total_includes_every_head(): void
    {
        // 120000 + 50000 + 20000 stored, + 193000 manpower + 325000 equipment + 30000 other
        $this->assertSame(738000, ProjectBudget::yearTotal($this->sample(), 'year1'));
    }

    public function test_grand_total_sums_the_years(): void
    {
        $b = $this->sample();
        $b['year2'] = ['Travel' => 10000];
        $b['__manpower']['year2'] = [['category' => 'SRF', 'count' => 1, 'amount' => 35000]];
        $this->assertSame(738000 + 45000, ProjectBudget::grandTotal($b));
    }

    public function test_years_excludes_the_reserved_keys(): void
    {
        $b = $this->sample();
        $b['year2'] = [];
        $this->assertSame(['year1', 'year2'], ProjectBudget::years($b));
    }

    public function test_the_five_manpower_categories_are_offered_and_phd_scholar_is_not(): void
    {
        $this->assertSame(['Postdoc', 'JRF', 'SRF', 'UG Intern', 'PG Intern'], ProjectBudget::MANPOWER_CATEGORIES);
        $this->assertNotContains('PhD Scholar', ProjectBudget::MANPOWER_CATEGORIES);
    }

    public function test_equipment_head_offers_no_predefined_sub_items(): void
    {
        $equipment = collect(ProjectBudget::heads())->firstWhere('head', 'Equipment');
        $this->assertSame([], $equipment['subItems']);
    }

    // ---- legacy migration ----

    public function test_legacy_manpower_sub_items_become_counted_lines_keeping_their_category(): void
    {
        $legacy = [
            'year1' => ['Manpower' => 90000],
            '__subitems' => ['year1' => ['Manpower' => ['PhD Scholar' => 60000, 'JRF' => 30000]]],
        ];
        $n = ProjectBudget::normalize($legacy);

        $this->assertSame(
            [
                ['category' => 'PhD Scholar', 'count' => 1, 'amount' => 60000],
                ['category' => 'JRF', 'count' => 1, 'amount' => 30000],
            ],
            $n['__manpower']['year1']
        );
        $this->assertSame(90000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
        $this->assertArrayNotHasKey('Manpower', $n['year1']);
        $this->assertArrayNotHasKey('Manpower', $n['__subitems']['year1'] ?? []);
    }

    public function test_legacy_equipment_sub_items_become_free_form_items(): void
    {
        $legacy = [
            'year1' => ['Equipment' => 95000],
            '__subitems' => ['year1' => ['Equipment' => ['Laptop' => 70000, 'Printer' => 25000]]],
        ];
        $n = ProjectBudget::normalize($legacy);

        $this->assertSame(
            [['item' => 'Laptop', 'amount' => 70000], ['item' => 'Printer', 'amount' => 25000]],
            $n['__equipment']['year1']
        );
        $this->assertSame(95000, ProjectBudget::headTotal($n, 'year1', 'Equipment'));
    }

    public function test_a_legacy_head_amount_with_no_sub_items_is_carried_as_one_unlabelled_line(): void
    {
        $legacy = ['year1' => ['Manpower' => 40000, 'Equipment' => 15000]];
        $n = ProjectBudget::normalize($legacy);

        $this->assertSame([['category' => '', 'count' => 1, 'amount' => 40000]], $n['__manpower']['year1']);
        $this->assertSame([['item' => '', 'amount' => 15000]], $n['__equipment']['year1']);
        $this->assertSame(40000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
        $this->assertSame(15000, ProjectBudget::headTotal($n, 'year1', 'Equipment'));
    }

    public function test_normalizing_a_legacy_budget_preserves_its_grand_total(): void
    {
        $legacy = [
            'year1' => ['Manpower' => 90000, 'Travel' => 20000, 'Equipment' => 95000, 'Contingency' => 5000],
            '__subitems' => ['year1' => [
                'Manpower' => ['PhD Scholar' => 60000, 'JRF' => 30000],
                'Equipment' => ['Laptop' => 70000, 'Printer' => 25000],
                'Travel' => ['Domestic' => 20000],
            ]],
        ];
        $before = 90000 + 20000 + 95000 + 5000;
        $this->assertSame($before, ProjectBudget::grandTotal(ProjectBudget::normalize($legacy)));
    }

    public function test_normalize_is_idempotent(): void
    {
        $once = ProjectBudget::normalize($this->sample());
        $this->assertSame($once, ProjectBudget::normalize($once));
    }

    /**
     * Finding 8: idempotence on the already-new sample() alone doesn't exercise
     * anything a legacy row can do — a stored head with no breakdown, a stored
     * head that disagrees with its breakdown (so normalize() itself adds a
     * reconciling line), an orphan __manpower year, and an unknown legacy head
     * are all shapes where a second pass could plausibly behave differently
     * from the first. It must not.
     */
    public function test_normalize_is_idempotent_across_legacy_shapes(): void
    {
        $shapes = [
            'head with no breakdown' => ['year1' => ['Manpower' => 90000, 'Equipment' => 15000]],
            'head matching its breakdown' => [
                'year1' => ['Manpower' => 90000],
                '__subitems' => ['year1' => ['Manpower' => ['PhD Scholar' => 60000, 'JRF' => 30000]]],
            ],
            'head disagreeing with its breakdown (creates a reconciling line)' => [
                'year1' => ['Manpower' => 100000],
                '__subitems' => ['year1' => ['Manpower' => ['X' => 30000]]],
            ],
            'orphan __manpower year' => [
                '__manpower' => ['year1' => [['category' => 'Postdoc', 'count' => 2, 'amount' => 30000]]],
            ],
            'unknown legacy head' => ['year1' => ['Consumables' => 75000, 'Travel' => 10000]],
        ];

        foreach ($shapes as $label => $shape) {
            $once = ProjectBudget::normalize($shape);
            $this->assertSame($once, ProjectBudget::normalize($once), "not idempotent for: {$label}");
        }
    }

    public function test_it_tolerates_null_and_junk(): void
    {
        $this->assertSame([], ProjectBudget::years(ProjectBudget::normalize(null)));
        $this->assertSame(0, ProjectBudget::grandTotal(ProjectBudget::normalize('nonsense')));
    }

    public function test_it_accepts_a_json_string(): void
    {
        $json = json_encode(['year1' => ['Travel' => 5000]]);
        $this->assertSame(5000, ProjectBudget::grandTotal(ProjectBudget::normalize($json)));
    }

    // ---- code review findings: the legacy-total invariant ----
    //
    // The old portal's total for a year is the sum of the plain values in
    // budget[year] (see the class docblock on ProjectBudget). For every shape
    // below that has a real budget[year] row, normalize() must reproduce that
    // exact total — no head's money may be dropped, invented, or shifted by
    // migrating it forward.

    public function test_head_vs_disagreeing_subitems_reconciles_without_losing_or_inventing_money(): void
    {
        // Head bigger than its breakdown: the gap must be added back, not dropped.
        $legacy = [
            'year1' => ['Manpower' => 100000],
            '__subitems' => ['year1' => ['Manpower' => ['X' => 30000]]],
        ];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(100000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
        $this->assertSame(
            [
                ['category' => 'X', 'count' => 1, 'amount' => 30000],
                ['category' => 'Unallocated (legacy total)', 'count' => 1, 'amount' => 70000],
            ],
            $n['__manpower']['year1']
        );

        // Breakdown bigger than its head: the excess must be removed back out, not invented.
        $legacy = [
            'year1' => ['Manpower' => 30000],
            '__subitems' => ['year1' => ['Manpower' => ['X' => 100000]]],
        ];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(30000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
        $this->assertSame(-70000, $n['__manpower']['year1'][1]['amount']);
    }

    public function test_a_stored_head_plus_new_shape_lines_for_the_same_year_reconciles_to_the_stored_head(): void
    {
        $legacy = [
            'year1' => ['Manpower' => 50000],
            '__manpower' => ['year1' => [['category' => 'Postdoc', 'count' => 2, 'amount' => 10000]]],
        ];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(50000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
    }

    public function test_an_unknown_stored_head_is_preserved_and_counted(): void
    {
        $legacy = ['year1' => ['Consumables' => 75000, 'Travel' => 10000]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(85000, ProjectBudget::yearTotal($n, 'year1'));
        $this->assertSame(75000, $n['year1']['Consumables']);
    }

    public function test_negative_stored_head_is_preserved_not_clamped(): void
    {
        $legacy = ['year1' => ['Contingency' => -5000]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(-5000, ProjectBudget::headTotal($n, 'year1', 'Contingency'));
        $this->assertSame(-5000, ProjectBudget::yearTotal($n, 'year1'));
    }

    public function test_negative_line_amount_and_count_are_preserved_not_clamped(): void
    {
        // count x amount still comes out positive (-2 x -500), and the stored head agrees,
        // so there's no reconciliation line — but the line itself must keep its sign.
        $legacy = [
            'year1' => ['Manpower' => 1000],
            '__manpower' => ['year1' => [['category' => 'X', 'count' => -2, 'amount' => -500]]],
        ];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(['category' => 'X', 'count' => -2, 'amount' => -500], $n['__manpower']['year1'][0]);
        $this->assertSame(1000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
    }

    public function test_subitems_for_a_head_with_no_stored_amount_reconcile_to_zero_but_stay_visible(): void
    {
        // The old total never counted this head at all (no key present), so the migrated
        // total for it must be zero — but the money the subitems recorded is kept as a
        // visible line, with an equally visible line bringing the head back to zero.
        $legacy = [
            'year1' => [],
            '__subitems' => ['year1' => ['Manpower' => ['PhD Scholar' => 60000]]],
        ];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(0, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
        $this->assertSame(
            [
                ['category' => 'PhD Scholar', 'count' => 1, 'amount' => 60000],
                ['category' => 'Unallocated (legacy total)', 'count' => 1, 'amount' => -60000],
            ],
            $n['__manpower']['year1']
        );
    }

    public function test_contingency_subitems_are_ignored_without_crashing(): void
    {
        $legacy = [
            'year1' => ['Contingency' => 50000],
            '__subitems' => ['year1' => ['Contingency' => ['Foo' => 20000, 'Bar' => 30000]]],
        ];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(50000, ProjectBudget::yearTotal($n, 'year1'));
    }

    public function test_a_stored_any_other_expenses_with_no_breakdown_is_one_unlabelled_line(): void
    {
        $legacy = ['year1' => ['Any Other Expenses' => 30000]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(30000, ProjectBudget::headTotal($n, 'year1', 'Any Other Expenses'));
        $this->assertSame([['label' => '', 'amount' => 30000]], $n['__other']['year1']);
    }

    public function test_a_numeric_string_head_amount_is_accepted(): void
    {
        $legacy = ['year1' => ['Travel' => '50000']];
        $this->assertSame(50000, ProjectBudget::grandTotal(ProjectBudget::normalize($legacy)));
    }

    public function test_year_keys_that_are_not_yearn_are_accepted(): void
    {
        $legacy = ['2024-25' => ['Travel' => 5000]];
        $this->assertSame(5000, ProjectBudget::grandTotal(ProjectBudget::normalize($legacy)));

        $legacy = [2024 => ['Travel' => 7000]];
        $this->assertSame(7000, ProjectBudget::grandTotal(ProjectBudget::normalize($legacy)));
    }

    public function test_a_scalar_top_level_value_contributes_nothing_without_crashing(): void
    {
        $legacy = ['year1' => 5000];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(['year1'], ProjectBudget::years($n));
        $this->assertSame(0, ProjectBudget::yearTotal($n, 'year1'));
    }

    public function test_a_scalar_year_value_does_not_corrupt_a_sibling_year(): void
    {
        $legacy = ['year1' => 5000, 'year2' => ['Travel' => 3000]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(0, ProjectBudget::yearTotal($n, 'year1'));
        $this->assertSame(3000, ProjectBudget::yearTotal($n, 'year2'));
    }

    public function test_nested_junk_as_a_year_value_contributes_nothing_without_crashing(): void
    {
        $legacy = ['year1' => ['not', 'a map']];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(0, ProjectBudget::yearTotal($n, 'year1'));
    }

    public function test_an_orphan_manpower_year_is_preserved_not_dropped(): void
    {
        // Finding 4's exact probe: a year that exists only via __manpower (the shape the
        // new model makes natural) used to be dropped from years() entirely — 60000 -> 0.
        $legacy = ['__manpower' => ['year1' => [['category' => 'Postdoc', 'count' => 2, 'amount' => 30000]]]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(['year1'], ProjectBudget::years($n));
        $this->assertSame(60000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
    }

    public function test_an_orphan_subitems_year_is_preserved_not_dropped(): void
    {
        $legacy = ['__subitems' => ['year1' => ['Manpower' => ['JRF' => 20000]]]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(['year1'], ProjectBudget::years($n));
        $this->assertSame(20000, ProjectBudget::headTotal($n, 'year1', 'Manpower'));
    }

    public function test_float_amounts_are_rounded_once_not_truncated(): void
    {
        // Each figure is rounded exactly once at the point it's stored, not truncated at
        // several points along the read path — the old bug always lost money (truncating
        // 1000.75 and 2000.50 down to 1000 and 2000 lost 1.25 overall); rounding instead
        // is unbiased, so round(1000.75) + round(2000.50) = 1001 + 2001 = 3002.
        $legacy = ['year1' => ['Travel' => 1000.75, 'Contingency' => 2000.50]];
        $n = ProjectBudget::normalize($legacy);
        $this->assertSame(3002, ProjectBudget::yearTotal($n, 'year1'));
    }

    /** @return array<string, array{0: array, 1: string}> */
    public static function legacyTotalShapeProvider(): array
    {
        return [
            'head bigger than its disagreeing subitems' => [
                ['year1' => ['Manpower' => 100000], '__subitems' => ['year1' => ['Manpower' => ['X' => 30000]]]],
                'year1',
            ],
            'subitems bigger than their disagreeing head' => [
                ['year1' => ['Manpower' => 30000], '__subitems' => ['year1' => ['Manpower' => ['X' => 100000]]]],
                'year1',
            ],
            'stored head plus new-shape lines for the same year' => [
                [
                    'year1' => ['Manpower' => 50000],
                    '__manpower' => ['year1' => [['category' => 'Postdoc', 'count' => 2, 'amount' => 10000]]],
                ],
                'year1',
            ],
            'an unknown stored head' => [
                ['year1' => ['Consumables' => 75000, 'Travel' => 10000]],
                'year1',
            ],
            'negative stored head' => [
                ['year1' => ['Contingency' => -5000]],
                'year1',
            ],
            'negative line amount and count matching their stored head' => [
                [
                    'year1' => ['Manpower' => 1000],
                    '__manpower' => ['year1' => [['category' => 'X', 'count' => -2, 'amount' => -500]]],
                ],
                'year1',
            ],
            'subitems for a head with no stored amount' => [
                ['year1' => [], '__subitems' => ['year1' => ['Manpower' => ['PhD Scholar' => 60000]]]],
                'year1',
            ],
            'contingency subitems (not a lines head)' => [
                ['year1' => ['Contingency' => 50000], '__subitems' => ['year1' => ['Contingency' => ['Foo' => 20000]]]],
                'year1',
            ],
            'a stored Any Other Expenses with no breakdown' => [
                ['year1' => ['Any Other Expenses' => 30000]],
                'year1',
            ],
            'a numeric-string head amount' => [
                ['year1' => ['Travel' => '50000']],
                'year1',
            ],
            'a non-yearN string year key' => [
                ['2024-25' => ['Travel' => 5000]],
                '2024-25',
            ],
            'a non-yearN integer year key' => [
                [2024 => ['Travel' => 7000]],
                2024,
            ],
            'a scalar top-level year value' => [
                ['year1' => 5000],
                'year1',
            ],
            'nested junk as a year value' => [
                ['year1' => ['not', 'a map']],
                'year1',
            ],
            'float amounts in a head' => [
                ['year1' => ['Travel' => 1000.75, 'Contingency' => 2000.50]],
                'year1',
            ],
        ];
    }

    /**
     * The requirement that matters most: for every year that genuinely existed in the
     * input, normalize() must reproduce the exact total the old portal already showed
     * for it — the sum of the plain values in budget[year], each rounded once. Nothing
     * about a head's derivation, a mismatch with its breakdown, or junk elsewhere in the
     * row may change that number.
     */
    #[DataProvider('legacyTotalShapeProvider')]
    public function test_normalize_preserves_the_exact_legacy_year_total(array $raw, string|int $year): void
    {
        $expected = $this->legacyYearTotal($raw[$year] ?? null);
        $this->assertSame($expected, ProjectBudget::yearTotal(ProjectBudget::normalize($raw), $year));
    }

    /**
     * What the old portal already showed as a year's total: the plain values sitting
     * directly under budget[year], each rounded once (never truncated), non-numeric or
     * non-array junk contributing nothing. This mirrors the rule stated in the review,
     * not ProjectBudget's own internals, so it stays an independent check on the total.
     */
    private function legacyYearTotal(mixed $yearValue): int
    {
        if (!is_array($yearValue)) {
            return 0;
        }

        $sum = 0;
        foreach ($yearValue as $value) {
            if (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value))) {
                $sum += (int) round((float) $value);
            }
        }

        return $sum;
    }
}
