<?php

namespace Tests\Unit;

use Tests\TestCase;

class SdgConfigTest extends TestCase
{
    public function test_there_are_seventeen_goals_numbered_one_to_seventeen(): void
    {
        $sdgs = config('sdgs.goals');

        $this->assertCount(17, $sdgs);
        $this->assertSame(range(1, 17), array_column($sdgs, 'id'));
    }

    public function test_the_labels_match_the_spec_exactly(): void
    {
        $this->assertSame([
            'No Poverty',
            'Zero Hunger',
            'Good Health and Well-being',
            'Quality Education',
            'Gender Equality',
            'Clean Water and Sanitation',
            'Affordable and Clean Energy',
            'Decent Work and Economic Growth',
            'Industry, Innovation and Infrastructure',
            'Reduced Inequalities',
            'Sustainable Cities and Communities',
            'Responsible Consumption and Production',
            'Climate Action',
            'Life Below Water',
            'Life on Land',
            'Peace, Justice, and Strong Institutions',
            'Partnerships for the Goals',
        ], array_column(config('sdgs.goals'), 'label'));
    }
}
