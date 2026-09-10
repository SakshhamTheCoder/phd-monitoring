<?php

namespace Tests;

use App\Models\AppSetting;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    use CreatesApplication;

    /**
     * AppSetting memoises per request; a test process is one long request, and
     * a rolled-back transaction does not undo a static. Drop it per test.
     */
    protected function setUp(): void
    {
        parent::setUp();
        AppSetting::forgetCache();
    }
}
