<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;

/**
 * Mail sent while somebody waits.
 *
 * Every one of these sends opened an SMTP connection to Gmail inside the
 * request, so creating a user or submitting an application sat spinning for
 * seconds before the page could say anything, and a slow mail server looked
 * like a slow portal. Handing the send to afterResponse() means the answer
 * goes out first and the mail follows in the same process, so it still needs
 * no queue worker.
 *
 * A failed mail is logged, never thrown: the record is already saved, and
 * losing it because a mail server was down would be the worse outcome.
 */
class Outbox
{
    public static function afterResponse(callable $send, string $what): void
    {
        $guarded = function () use ($send, $what) {
            try {
                $send();
            } catch (\Throwable $e) {
                Log::error($what . ' mail failed: ' . $e->getMessage());
            }
        };

        // A worker or a command has no response to come after, so it sends now.
        if (app()->runningInConsole()) {
            $guarded();
            return;
        }

        dispatch($guarded)->afterResponse();
    }
}
