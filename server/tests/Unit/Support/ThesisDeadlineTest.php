<?php

namespace Tests\Unit\Support;

use App\Support\ThesisDeadline;
use Tests\TestCase;

class ThesisDeadlineTest extends TestCase
{
    public function test_the_window_is_counted_from_the_date_of_admission(): void
    {
        $this->assertSame('2027-08-01', ThesisDeadline::earliest('2024-08-01', 3));
        $this->assertSame('2030-08-01', ThesisDeadline::latest('2024-08-01', 6));
    }

    public function test_granted_extensions_push_the_deadline_out_in_months(): void
    {
        $this->assertSame('2031-08-01', ThesisDeadline::latest('2024-08-01', 6, 12));
        $this->assertSame('2032-08-01', ThesisDeadline::latest('2024-08-01', 6, 24));
    }

    public function test_female_and_physically_handicapped_students_get_the_longer_base(): void
    {
        $this->assertSame(6, ThesisDeadline::baseYearsFor('Male', false, 6, 8));
        $this->assertSame(8, ThesisDeadline::baseYearsFor('Female', false, 6, 8));
        $this->assertSame(8, ThesisDeadline::baseYearsFor('Male', true, 6, 8));
        $this->assertSame(8, ThesisDeadline::baseYearsFor('Female', true, 6, 8));
    }

    /** An unrecorded gender must not silently buy the longer window. */
    public function test_an_unknown_gender_falls_to_the_shorter_base(): void
    {
        $this->assertSame(6, ThesisDeadline::baseYearsFor(null, false, 6, 8));
    }

    public function test_days_remaining_goes_negative_once_the_deadline_passes(): void
    {
        $this->assertSame(30, ThesisDeadline::daysRemaining('2030-08-01', '2030-07-02'));
        $this->assertSame(0, ThesisDeadline::daysRemaining('2030-08-01', '2030-08-01'));
        $this->assertSame(-1, ThesisDeadline::daysRemaining('2030-08-01', '2030-08-02'));
    }
}
