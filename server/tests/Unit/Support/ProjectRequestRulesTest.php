<?php

namespace Tests\Unit\Support;

use App\Support\ProjectRequestRules;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class ProjectRequestRulesTest extends TestCase
{
    private function validate(array $data): \Illuminate\Contracts\Validation\Validator
    {
        return Validator::make($data, ProjectRequestRules::forStore());
    }

    public function test_a_duration_of_one_to_five_years_passes(): void
    {
        foreach ([1, 2, 3, 4, 5] as $years) {
            $v = $this->validate(['title' => 'T', 'category' => 'Research', 'duration_years' => $years]);
            $this->assertFalse($v->errors()->has('duration_years'), "year {$years} should be allowed");
        }
    }

    public function test_zero_and_six_years_are_rejected(): void
    {
        $this->assertTrue($this->validate(['title' => 'T', 'category' => 'Research', 'duration_years' => 0])->errors()->has('duration_years'));
        $this->assertTrue($this->validate(['title' => 'T', 'category' => 'Research', 'duration_years' => 6])->errors()->has('duration_years'));
    }

    public function test_months_are_zero_to_eleven(): void
    {
        $this->assertFalse($this->validate(['title' => 'T', 'category' => 'Research', 'duration_months' => 0])->errors()->has('duration_months'));
        $this->assertFalse($this->validate(['title' => 'T', 'category' => 'Research', 'duration_months' => 11])->errors()->has('duration_months'));
        $this->assertTrue($this->validate(['title' => 'T', 'category' => 'Research', 'duration_months' => 12])->errors()->has('duration_months'));
    }

    public function test_sdgs_must_be_goal_numbers(): void
    {
        $this->assertFalse($this->validate(['title' => 'T', 'category' => 'Research', 'sdgs' => [1, 9, 17]])->errors()->hasAny(['sdgs', 'sdgs.0', 'sdgs.1', 'sdgs.2']));
        $this->assertTrue($this->validate(['title' => 'T', 'category' => 'Research', 'sdgs' => [18]])->errors()->has('sdgs.0'));
        $this->assertTrue($this->validate(['title' => 'T', 'category' => 'Research', 'sdgs' => [0]])->errors()->has('sdgs.0'));
    }

    public function test_objectives_are_strings(): void
    {
        $this->assertFalse($this->validate(['title' => 'T', 'category' => 'Research', 'objectives' => ['To do a thing.']])->errors()->has('objectives.0'));
    }

    public function test_a_gantt_chart_is_optional(): void
    {
        $this->assertFalse($this->validate(['title' => 'T', 'category' => 'Research'])->errors()->has('gantt_chart'));
    }

    // Regression for I1: ProjectBudget::reconcile legitimately emits a
    // negative "Unallocated (legacy total)" line when a migrated head
    // disagrees with its breakdown. That value must round-trip on save.
    public function test_budget_line_amounts_may_be_negative(): void
    {
        $data = [
            'title' => 'T',
            'category' => 'Research',
            'budget' => [
                '__manpower' => [
                    'year1' => [
                        ['category' => 'Unallocated (legacy total)', 'count' => 1, 'amount' => -60000],
                    ],
                ],
                '__equipment' => [
                    'year1' => [['item' => 'X', 'amount' => -100]],
                ],
                '__other' => [
                    'year1' => [['label' => 'Y', 'amount' => -50]],
                ],
            ],
        ];
        $errors = $this->validate($data)->errors();
        $this->assertFalse($errors->has('budget.__manpower.year1.0.amount'));
        $this->assertFalse($errors->has('budget.__equipment.year1.0.amount'));
        $this->assertFalse($errors->has('budget.__other.year1.0.amount'));
    }

    public function test_budget_line_count_must_still_be_non_negative(): void
    {
        $data = [
            'title' => 'T',
            'category' => 'Research',
            'budget' => [
                '__manpower' => [
                    'year1' => [
                        ['category' => 'JRF', 'count' => -1, 'amount' => 1000],
                    ],
                ],
            ],
        ];
        $this->assertTrue($this->validate($data)->errors()->has('budget.__manpower.year1.0.count'));
    }

    // Regression for the duration_years minor: a legacy project with
    // duration_years > 5 must not be blocked from an update that leaves that
    // field untouched, but a NEW out-of-range value is still rejected.
    public function test_forUpdate_tolerates_an_unchanged_legacy_duration_years(): void
    {
        $rules = ProjectRequestRules::forUpdate(7);
        $v = Validator::make(['title' => 'New Title', 'duration_years' => 7], $rules);
        $this->assertFalse($v->errors()->has('duration_years'));
    }

    public function test_forUpdate_still_rejects_a_new_out_of_range_duration_years(): void
    {
        $rules = ProjectRequestRules::forUpdate(7);
        $v = Validator::make(['title' => 'New Title', 'duration_years' => 8], $rules);
        $this->assertTrue($v->errors()->has('duration_years'));

        $rulesNoLegacy = ProjectRequestRules::forUpdate(null);
        $v2 = Validator::make(['title' => 'New Title', 'duration_years' => 6], $rulesNoLegacy);
        $this->assertTrue($v2->errors()->has('duration_years'));
    }
}
