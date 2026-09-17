<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Log;
use Tests\TestCase;

/**
 * The request log is shown on the admin Logs page. It was written with the
 * whole header set and body, so bearer tokens and login passwords sat in it.
 */
class RequestLogKeepsSecretsOutTest extends TestCase
{
    public function test_a_login_leaves_no_password_or_token_in_the_log(): void
    {
        $written = [];
        Log::listen(function ($event) use (&$written) {
            $written[] = json_encode($event->context);
        });

        $this->withHeader('Authorization', 'Bearer should-not-appear')
            ->postJson('/api/login', ['email' => 'nobody@example.invalid', 'password' => 'should-not-appear-either']);

        $log = implode("\n", $written);
        $this->assertStringNotContainsString('should-not-appear', $log);
        $this->assertStringContainsString('[redacted]', $log);
    }
}
