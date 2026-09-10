<?php

namespace Tests\Unit\Support;

use App\Models\AppSetting;
use App\Support\SupervisionCapacity;
use Tests\TestCase;

/**
 * How many scholars a rank may guide, and which designations count as that
 * rank.
 *
 * The tiering is the fragile half: the institute writes a designation a dozen
 * ways, and "Assistant Professor-II" contains the word "Professor", so an
 * order-of-checks mistake would quietly give a junior the professor's ceiling.
 */
class SupervisionCapacityTest extends TestCase
{
    public function test_a_designation_lands_in_the_rank_it_names(): void
    {
        $cases = [
            'Professor' => 'professor',
            'Senior Professor' => 'professor',
            'Professor (Term)' => 'professor',
            'Associate Professor' => 'associate_professor',
            'Associate Professor-I' => 'associate_professor',
            'Associate Professor (SLAS)' => 'associate_professor',
            'Assistant Professor' => 'assistant_professor',
            'Assistant Professor-III' => 'assistant_professor',
            'Assistant Professor (SLAS)' => 'assistant_professor',
            // Administrative posts name no rank, so they get their own ceiling
            // rather than inheriting a professor's.
            'DORDC' => 'other',
            'Teacher' => 'other',
            '' => 'other',
            null => 'other',
        ];

        foreach ($cases as $designation => $expected) {
            $this->assertSame($expected, SupervisionCapacity::tier($designation === '' ? '' : $designation), (string) $designation);
        }
    }

    public function test_the_limit_follows_the_rank_and_is_configurable(): void
    {
        $this->assertSame(8, SupervisionCapacity::limitFor('Professor'));
        $this->assertSame(6, SupervisionCapacity::limitFor('Associate Professor-I'));
        $this->assertSame(4, SupervisionCapacity::limitFor('Assistant Professor-II'));

        AppSetting::put('supervision', 'max_assistant_professor', 5);
        AppSetting::forgetCache();

        $this->assertSame(5, SupervisionCapacity::limitFor('Assistant Professor-II'));

        AppSetting::where('group', 'supervision')->delete();
        AppSetting::forgetCache();
    }

    public function test_a_full_supervisor_has_no_slots_and_an_over_full_one_reports_zero_not_a_negative(): void
    {
        $this->assertSame(
            ['limit' => 4, 'current' => 4, 'remaining' => 0, 'is_full' => true],
            SupervisionCapacity::describeWithLoad('Assistant Professor', 4),
        );

        $this->assertSame(
            ['limit' => 4, 'current' => 6, 'remaining' => 0, 'is_full' => true],
            SupervisionCapacity::describeWithLoad('Assistant Professor', 6),
        );

        $this->assertSame(
            ['limit' => 8, 'current' => 3, 'remaining' => 5, 'is_full' => false],
            SupervisionCapacity::describeWithLoad('Professor', 3),
        );
    }
}
