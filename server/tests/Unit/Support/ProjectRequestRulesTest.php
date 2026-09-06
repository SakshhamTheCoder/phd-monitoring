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
}
