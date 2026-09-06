<?php

namespace Tests\Unit;

use App\Support\AttendanceSummary;
use Tests\TestCase;

class AttendanceSummaryTest extends TestCase
{
    private function records(int $present, int $absent): array
    {
        return array_merge(
            array_fill(0, $present, ['status' => 'present']),
            array_fill(0, $absent, ['status' => 'absent'])
        );
    }

    public function test_it_counts_and_computes_a_percentage(): void
    {
        $this->assertSame(
            ['total' => 5, 'present' => 4, 'absent' => 1, 'percent' => 80.0],
            AttendanceSummary::of($this->records(4, 1))
        );
    }

    public function test_an_empty_record_set_has_a_null_percentage_not_a_zero(): void
    {
        $summary = AttendanceSummary::of([]);

        $this->assertSame(0, $summary['total']);
        $this->assertNull($summary['percent'], 'no sessions is not the same as 0% attendance');
    }

    public function test_full_attendance_is_a_hundred(): void
    {
        $this->assertSame(100.0, AttendanceSummary::of($this->records(3, 0))['percent']);
    }

    public function test_the_percentage_is_rounded_to_one_decimal(): void
    {
        $this->assertSame(66.7, AttendanceSummary::of($this->records(2, 1))['percent']);
    }

    public function test_it_accepts_objects_as_well_as_arrays(): void
    {
        $records = [(object) ['status' => 'present'], (object) ['status' => 'absent']];

        $this->assertSame(50.0, AttendanceSummary::of($records)['percent']);
    }
}
