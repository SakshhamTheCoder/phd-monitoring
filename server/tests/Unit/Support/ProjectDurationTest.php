<?php

namespace Tests\Unit\Support;

use App\Support\ProjectDuration;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProjectDurationTest extends TestCase
{
    public static function formatCases(): array
    {
        return [
            'years and months' => [3, 4, '3 Years 4 Months'],
            'years only'       => [3, 0, '3 Years'],
            'months only'      => [0, 8, '8 Months'],
            'one of each'      => [1, 1, '1 Year 1 Month'],
            'single year'      => [1, 0, '1 Year'],
            'single month'     => [0, 1, '1 Month'],
            'five years'       => [5, 0, '5 Years'],
            'empty'            => [0, 0, '—'],
            'nulls'            => [null, null, '—'],
        ];
    }

    #[DataProvider('formatCases')]
    public function test_it_formats_without_zero_components(?int $y, ?int $m, string $expected): void
    {
        $this->assertSame($expected, ProjectDuration::format($y, $m));
    }

    public function test_it_never_prints_a_zero_component(): void
    {
        for ($y = 0; $y <= 5; $y++) {
            for ($m = 0; $m <= 11; $m++) {
                $this->assertDoesNotMatchRegularExpression('/\b0 (Years|Months)\b/', ProjectDuration::format($y, $m));
            }
        }
    }

    public function test_total_months(): void
    {
        $this->assertSame(40, ProjectDuration::totalMonths(3, 4));
        $this->assertSame(8, ProjectDuration::totalMonths(0, 8));
        $this->assertSame(0, ProjectDuration::totalMonths(null, null));
    }

    public function test_year_options_are_one_through_five(): void
    {
        $this->assertSame([1, 2, 3, 4, 5], ProjectDuration::yearOptions());
    }
}
