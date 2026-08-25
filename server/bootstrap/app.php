<?php

use App\Http\Middleware\LogRequestResponse;
use App\Http\Middleware\ParseRollNumber;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'parseRollNumber' => ParseRollNumber::class,
        ]);

        // Register LogRequestResponse middleware globally
        $middleware->append([
            LogRequestResponse::class,
        ]);

        // Blocks requests from a user whose current role has no backing record,
        // so the ~30 unguarded `$user->faculty->faculty_code` style reads in the
        // controllers cannot produce a 500. Runs after auth; no-ops for guests.
        $middleware->append([
            \App\Http\Middleware\EnsureCurrentRoleIsBacked::class,
        ]);

        $middleware->alias([
            'add.approval' => \App\Http\Middleware\AddApprovalFlag::class,
            // Used as feature:research_profile / feature:project_management /
            // feature:job_openings on the route groups those modules own.
            'feature' => \App\Http\Middleware\EnsureFeatureEnabled::class,
        ]);

        // The auth middleware resolves its guest redirect eagerly, and the
        // default is route('login'), which an API-only app never defined. That
        // threw before any AuthenticationException existed, so an unauthenticated
        // request without an Accept: application/json header came back as a 500.
        // No redirect for the API; the exception renderer answers with a 401.
        $middleware->redirectGuestsTo(
            fn($request) => $request->is('api/*') ? null : '/login'
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Throwable $e, $request) {
            // An unauthenticated request is routine, not a fault. It was being
            // written to laravel.log with a full stack trace on every hit.
            if ($e instanceof \Illuminate\Auth\AuthenticationException) {
                return;
            }

            Log::error('Global Exception Handler', [
                'message' => $e->getMessage(),
                'url' => $request->fullUrl(),
                'trace' => $e->getTraceAsString(),
            ]);
        });

        // Without this, an unauthenticated request that does not ask for JSON
        // falls through to a redirect to the `login` route, which an API-only
        // app has never defined, and the missing route surfaces as a 500.
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }
        });
    })
    ->create();