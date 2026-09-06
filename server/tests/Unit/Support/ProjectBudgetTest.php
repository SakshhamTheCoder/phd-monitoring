<?php

namespace Tests\Unit\Support;

use App\Support\ProjectBudget;
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
        $b = ['__manpower' => ['year1' => [['category' => 'Postdoc', 'count' => 0, 'amount' => 50000]]]];
        $this->assertSame(0, ProjectBudget::headTotal(ProjectBudget::normalize($b), 'year1', 'Manpower'));
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
}
