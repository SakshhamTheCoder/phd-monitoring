<?php

namespace Tests\Unit;

use App\Support\ReportPeriods;
use Carbon\Carbon;
use PHPUnit\Framework\TestCase;

/**
 * The same terms generateReportPeriods (client-new/src/utils/semester.js)
 * gives on the same day, taken from running it with the clock set to each date.
 */
class ReportPeriodsTest extends TestCase
{
    public function test_an_odd_term_offers_itself_and_the_even_term_before(): void
    {
        $this->assertSame(['2526EVEN', '2627ODD'], ReportPeriods::around(0, 1, true, Carbon::create(2026, 9, 24)));
    }

    public function test_an_even_term_keeps_the_page_s_year_early_odd_term(): void
    {
        // The browser gives 2425ODD here; see the class comment.
        $this->assertSame(['2425ODD', '2526EVEN'], ReportPeriods::around(0, 1, true, Carbon::create(2026, 2, 15)));
    }

    public function test_the_term_turns_over_on_the_first_of_july(): void
    {
        $this->assertSame(['2425ODD', '2526EVEN'], ReportPeriods::around(0, 1, true, Carbon::create(2026, 6, 30)));
        $this->assertSame(['2526EVEN', '2627ODD'], ReportPeriods::around(0, 1, true, Carbon::create(2026, 7, 1)));
    }

    public function test_a_wider_window_without_the_current_term(): void
    {
        $this->assertSame(['2425EVEN', '2526ODD', '2526EVEN'], ReportPeriods::around(1, 1, false, Carbon::create(2026, 9, 24)));
    }
}
