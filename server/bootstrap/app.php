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
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (\Throwable $e, $request) {
            Log::error('Global Exception Handler', [
                'message' => $e->getMessage(),
                'url' => $request->fullUrl(),
                'trace' => $e->getTraceAsString(),
            ]);
        });
    })
    ->create();