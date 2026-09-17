<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Tests and e2e runs work on copies of real data. EmailService switches the
 * mailer to SMTP at runtime, so MAIL_MAILER=array alone does not keep mail in.
 */
class MailIsNeverSentOutsideProductionTest extends TestCase
{
    public function test_a_message_on_a_live_smtp_mailer_is_cancelled_before_it_connects(): void
    {
        // Port 1 on loopback refuses, so a send that got this far would throw.
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.host' => '127.0.0.1',
            'mail.mailers.smtp.port' => 1,
        ]);

        $sent = Mail::raw('body', fn ($message) => $message->to('scholar@example.invalid')->subject('probe'));

        $this->assertNull($sent);
    }
}
