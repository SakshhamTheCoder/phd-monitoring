<?php

namespace Tests\Unit;

use App\Support\UgYear;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;

/**
 * The year of study a sheet leaves out, read from the address instead.
 *
 * A year typed into a spreadsheet is wrong by the next session; the admission
 * year in the address never moves. The academic year turns over in July.
 */
class UgYearTest extends TestCase
{
    public function test_the_admission_year_in_the_address_says_which_year_they_are_in(): void
    {
        $october2026 = Carbon::create(2026, 10, 2);

        $this->assertSame(4, UgYear::fromEmail('nkaur_btech23@thapar.edu', $october2026));
        $this->assertSame(3, UgYear::fromEmail('abhardwaj2_be24@thapar.edu', $october2026));
        $this->assertSame(2, UgYear::fromEmail('achoudhary_blas25@thapar.edu', $october2026));
    }

    public function test_the_session_turns_over_in_july(): void
    {
        // Still the 2025-26 session on 30 June, so a 2024 admit is in their second year.
        $this->assertSame(2, UgYear::fromEmail('x_be24@thapar.edu', Carbon::create(2026, 6, 30)));
        $this->assertSame(3, UgYear::fromEmail('x_be24@thapar.edu', Carbon::create(2026, 7, 1)));
        $this->assertSame(2, UgYear::fromEmail('x_be25@thapar.edu', Carbon::create(2026, 7, 1)));
        $this->assertSame(1, UgYear::fromEmail('x_be25@thapar.edu', Carbon::create(2026, 6, 30)));
    }

    public function test_an_address_that_says_nothing_about_a_year_reads_as_nothing(): void
    {
        $this->assertNull(UgYear::fromEmail('someone@gmail.com'));
        $this->assertNull(UgYear::fromEmail('plain.name@thapar.edu'));
        $this->assertNull(UgYear::fromEmail(''));
        $this->assertNull(UgYear::fromEmail(null));
        // Admitted nine years ago: the address is not saying a year of study.
        $this->assertNull(UgYear::fromEmail('x_be17@thapar.edu', Carbon::create(2026, 10, 2)));
    }
}
