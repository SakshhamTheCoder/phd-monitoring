<?php

namespace Tests\Unit;

use App\Http\Middleware\LogRequestResponse;
use Tests\TestCase;

/**
 * logBody is private, so reach it through a reflection helper rather than
 * loosening the middleware's visibility for a test.
 */
class LogRequestResponseTest extends TestCase
{
    private function logBody(array $body)
    {
        $method = new \ReflectionMethod(LogRequestResponse::class, 'logBody');
        $method->setAccessible(true);

        return $method->invoke(new LogRequestResponse(), $body, false);
    }

    public function test_a_password_is_redacted_but_the_key_is_kept(): void
    {
        $result = $this->logBody(['email' => 'user@example.com', 'password' => 'secret123']);

        $this->assertSame('[redacted]', $result['password']);
        $this->assertSame('user@example.com', $result['email']);
    }

    public function test_a_nested_password_is_redacted(): void
    {
        $result = $this->logBody(['user' => ['name' => 'Jane', 'password' => 'secret123']]);

        $this->assertSame('[redacted]', $result['user']['password']);
        $this->assertSame('Jane', $result['user']['name']);
    }
}
