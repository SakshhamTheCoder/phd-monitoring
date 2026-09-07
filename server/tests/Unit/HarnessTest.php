<?php

namespace Tests\Unit;

use Tests\TestCase;

class HarnessTest extends TestCase
{
    public function test_the_application_boots(): void
    {
        $this->assertNotEmpty(config('app.name'));
    }
}
