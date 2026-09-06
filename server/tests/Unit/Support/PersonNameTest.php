<?php

namespace Tests\Unit\Support;

use App\Support\PersonName;
use Tests\TestCase;

class PersonNameTest extends TestCase
{
    public function test_a_two_word_name_splits_down_the_middle(): void
    {
        $this->assertSame(['first' => 'Khalid', 'last' => 'Bashir'], PersonName::split('Khalid Bashir'));
    }

    public function test_the_last_word_is_the_surname_however_many_words_precede_it(): void
    {
        $this->assertSame(['first' => 'Dr. Tarunpreet', 'last' => 'Bhatia'], PersonName::split('Dr. Tarunpreet Bhatia'));
        $this->assertSame(['first' => 'Maria del Carmen', 'last' => 'Rodriguez'], PersonName::split('Maria del Carmen Rodriguez'));
        $this->assertSame(['first' => 'Prof. Dr. Ing. Hans', 'last' => 'Mueller'], PersonName::split('Prof. Dr. Ing. Hans Mueller'));
    }

    public function test_a_single_word_name_keeps_the_conventional_blank_surname(): void
    {
        // ' ' rather than '' is what the existing controllers already write for
        // a missing surname, and users.last_name is not nullable everywhere.
        $this->assertSame(['first' => 'Prince', 'last' => ' '], PersonName::split('Prince'));
    }

    public function test_it_collapses_stray_whitespace(): void
    {
        $this->assertSame(['first' => 'Anita', 'last' => 'Desai'], PersonName::split('  Anita    Desai  '));
        $this->assertSame(['first' => 'Anita', 'last' => 'Desai'], PersonName::split("Anita\tDesai"));
    }

    public function test_an_empty_name_gives_empty_parts(): void
    {
        $this->assertSame(['first' => '', 'last' => ' '], PersonName::split(''));
        $this->assertSame(['first' => '', 'last' => ' '], PersonName::split('   '));
        $this->assertSame(['first' => '', 'last' => ' '], PersonName::split(null));
    }

    public function test_join_is_the_inverse_for_ordinary_names(): void
    {
        $this->assertSame('Khalid Bashir', PersonName::join('Khalid', 'Bashir'));
        $this->assertSame('Prince', PersonName::join('Prince', ' '));
        $this->assertSame('Prince', PersonName::join('Prince', null));
    }

    public function test_a_row_with_a_full_name_uses_it(): void
    {
        $this->assertSame(
            ['first' => 'Sakshham', 'last' => 'Bhagat'],
            PersonName::fromRow(['full_name' => 'Sakshham Bhagat'])
        );
    }

    public function test_a_row_with_the_legacy_pair_still_works(): void
    {
        $this->assertSame(
            ['first' => 'Tarunpreet', 'last' => 'Bhatia'],
            PersonName::fromRow(['first_name' => 'Tarunpreet', 'last_name' => 'Bhatia'])
        );
    }

    public function test_full_name_wins_when_a_row_carries_both(): void
    {
        $this->assertSame(
            ['first' => 'New', 'last' => 'Name'],
            PersonName::fromRow(['full_name' => 'New Name', 'first_name' => 'Old', 'last_name' => 'Name'])
        );
    }

    public function test_a_row_with_no_name_at_all_returns_null(): void
    {
        $this->assertNull(PersonName::fromRow(['email' => 'x@demo.invalid']));
        $this->assertNull(PersonName::fromRow(['full_name' => '   ', 'first_name' => '']));
    }

    public function test_it_reads_a_title_cased_header_too(): void
    {
        // The students template uses "Full Name" with a capital F and a space.
        $this->assertSame(['first' => 'Khalid', 'last' => 'Bashir'], PersonName::fromRow(['Full Name' => 'Khalid Bashir']));
    }
}
