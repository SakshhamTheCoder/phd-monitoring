<?php

namespace Tests\Unit;

use App\Models\AppSetting;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

class AppSettingTest extends TestCase
{
    use DatabaseTransactions;

    public function test_missing_rows_fall_back_to_defaults(): void
    {
        AppSetting::query()->delete();
        AppSetting::forgetCache();

        $this->assertSame(
            ['academic_quota' => 10, 'casual_quota' => 8, 'year_start_month' => 7],
            AppSetting::map('leave')
        );
    }

    public function test_a_stored_row_overrides_its_default(): void
    {
        AppSetting::put('leave', 'casual_quota', 12);

        $this->assertSame(12, AppSetting::value('leave', 'casual_quota'));
        $this->assertSame(10, AppSetting::value('leave', 'academic_quota'));
    }

    public function test_an_unknown_key_is_not_reported(): void
    {
        AppSetting::put('leave', 'nonsense', 3);

        $this->assertArrayNotHasKey('nonsense', AppSetting::map('leave'));
    }

    /** Groups are separate namespaces: the same key may exist in both. */
    public function test_a_key_is_scoped_to_its_group(): void
    {
        AppSetting::put('leave', 'casual_quota', 12);
        AppSetting::put('other', 'casual_quota', 99);

        $this->assertSame(12, AppSetting::value('leave', 'casual_quota'));
    }

    public function test_only_declared_groups_are_recognised(): void
    {
        $this->assertTrue(AppSetting::isGroup('leave'));
        $this->assertFalse(AppSetting::isGroup('nonsense'));
    }
}
