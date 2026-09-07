<?php

namespace Tests\Unit;

use App\Models\LeaveSetting;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class LeaveSettingTest extends TestCase
{
    use DatabaseTransactions;

    public function test_missing_rows_fall_back_to_defaults(): void
    {
        LeaveSetting::query()->delete();

        $this->assertSame(
            ['academic_quota' => 10, 'casual_quota' => 8, 'year_start_month' => 7],
            LeaveSetting::map()
        );
    }

    public function test_a_stored_row_overrides_its_default(): void
    {
        LeaveSetting::updateOrCreate(['key' => 'casual_quota'], ['value' => 12]);

        $this->assertSame(12, LeaveSetting::value('casual_quota'));
        $this->assertSame(10, LeaveSetting::value('academic_quota'));
    }

    public function test_an_unknown_key_is_not_reported(): void
    {
        LeaveSetting::updateOrCreate(['key' => 'nonsense'], ['value' => 3]);

        $this->assertArrayNotHasKey('nonsense', LeaveSetting::map());
    }
}
