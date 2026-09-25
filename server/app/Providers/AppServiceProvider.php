<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Mail\Events\MessageSending;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Test and e2e runs use copies of real data, so any address in them can
        // belong to a real person. EmailService forces the SMTP mailer at runtime,
        // which bypasses MAIL_MAILER, so the send itself is the only safe place to
        // stop mail. Returning false from MessageSending cancels the message.
        if ($this->app->environment(['testing', 'e2e'])) {
            Event::listen(MessageSending::class, function (MessageSending $event) {
                $recipients = array_map(fn ($address) => $address->getAddress(), $event->message->getTo());
                Log::info('Mail suppressed in ' . app()->environment() . ': "' . $event->message->getSubject() . '" to ' . implode(', ', $recipients));
                // The e2e run keeps what it would have sent, so a browser test can
                // read a reset link and follow it the way a new user would.
                if (app()->environment('e2e')) {
                    $outbox = storage_path('app/mail-outbox');
                    @mkdir($outbox, 0775, true);
                    file_put_contents($outbox . '/' . now()->format('Ymd-His-u') . '.eml', $event->message->toString());
                }
                return false;
            });
        }

        // Every capability is a gate of the same shape, so one rule answers for
        // all of them: `can:can_manage_users` on a route asks the acting role
        // exactly what $user->may('can_manage_users') asks inside a method.
        //
        // This lets a guard that is only a gate live on the route, where the
        // whole authorization surface can be read and tested as a list. Guards
        // that branch on a capability to decide *what* to return, rather than
        // whether to answer at all, stay where they are: those are scoping, not
        // authorization. StudentController::list reads four of them to choose
        // which scholars to show, and belongs in the method.
        Gate::before(function (User $user, string $ability) {
            return str_starts_with($ability, 'can_') ? $user->may($ability) : null;
        });

        // Password guessing and reset-mail flooding. Keyed by email and IP, not
        // IP alone: the campus sits behind NAT, so one address is many people.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(10)->by($request->input('email') . '|' . $request->ip()));
        RateLimiter::for('auth-email', fn (Request $request) => Limit::perMinute(3)->by($request->input('email') . '|' . $request->ip()));
    }
}
