<?php

namespace Tests\Feature;

use Tests\TestCase;

/**
 * The public routes each keep their own request count. An unnamed throttle
 * counts every such route together per address, so an outside expert who
 * opened the review page and its PDF a few times was refused their submit.
 */
class PublicThrottleTest extends TestCase
{
    public function test_reading_a_review_does_not_use_up_its_submits(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->getJson('/api/external-review/no-such-token')->assertStatus(404);
        }

        $this->postJson('/api/external-review/no-such-token')->assertStatus(404);
    }
}
