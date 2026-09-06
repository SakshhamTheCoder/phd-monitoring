<?php

namespace Tests\Unit\Support;

use App\Support\ProjectObjectives;
use Tests\TestCase;

class ProjectObjectivesTest extends TestCase
{
    public function test_it_passes_through_plain_strings(): void
    {
        $this->assertSame(
            ['To develop ABC so as to improve XYZ.', 'To evaluate the approach.'],
            ProjectObjectives::normalize(['To develop ABC so as to improve XYZ.', 'To evaluate the approach.'])
        );
    }

    public function test_it_folds_a_legacy_title_and_description_into_one_line(): void
    {
        $this->assertSame(
            ['Quantum Neural Optimization: Build the optimiser and benchmark it.'],
            ProjectObjectives::normalize([
                ['title' => 'Quantum Neural Optimization', 'description' => 'Build the optimiser and benchmark it.'],
            ])
        );
    }

    public function test_a_legacy_row_with_only_one_half_keeps_that_half(): void
    {
        $this->assertSame(['Only a title'], ProjectObjectives::normalize([['title' => 'Only a title', 'description' => '']]));
        $this->assertSame(['Only a description'], ProjectObjectives::normalize([['title' => '', 'description' => 'Only a description']]));
    }

    public function test_it_drops_blank_entries_and_collapses_whitespace(): void
    {
        $this->assertSame(
            ['To do the thing.'],
            ProjectObjectives::normalize(['  To do   the thing.  ', '', '   ', ['title' => '', 'description' => '']])
        );
    }

    public function test_it_tolerates_null_and_non_arrays(): void
    {
        $this->assertSame([], ProjectObjectives::normalize(null));
        $this->assertSame([], ProjectObjectives::normalize('not an array'));
        $this->assertSame([], ProjectObjectives::normalize([]));
    }

    public function test_it_accepts_a_json_string(): void
    {
        $this->assertSame(['One.', 'Two.'], ProjectObjectives::normalize('["One.","Two."]'));
    }

    public function test_it_folds_scalar_values_from_a_nested_list_array(): void
    {
        $this->assertSame(
            ['a b'],
            ProjectObjectives::normalize([['a', 'b']])
        );
    }

    public function test_it_folds_scalar_values_from_an_array_with_different_keys(): void
    {
        $this->assertSame(
            ['Do the thing.'],
            ProjectObjectives::normalize([['note' => 'Do the thing.']])
        );
    }

    public function test_it_casts_objects_to_arrays_and_folds_their_scalar_values(): void
    {
        $obj = (object) ['note' => 'Do the thing.'];
        $this->assertSame(['Do the thing.'], ProjectObjectives::normalize([$obj]));
    }

    public function test_genuinely_empty_entries_are_still_dropped(): void
    {
        $this->assertSame(
            [],
            ProjectObjectives::normalize([[], ['title' => '', 'description' => '']])
        );
    }
}
