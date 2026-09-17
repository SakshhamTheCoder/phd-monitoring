<?php
namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class LogRequestResponse
{
    // The log is readable from the admin Logs page, so nothing that signs
    // someone in may reach it. Headers and bodies were written whole, which put
    // every bearer token, and every password typed at login or reset, in it.
    private const SECRET_HEADERS = ['authorization', 'cookie', 'x-xsrf-token', 'x-csrf-token'];

    // Every list page's whole response went into the log on every request, so
    // the log grew by megabytes a day and each request paid for the write. An
    // error or a small answer is what debugging needs; a large one is noted by size.
    private const MAX_LOGGED_RESPONSE_BYTES = 2048;

    private const SECRET_FIELDS = [
        'password', 'password_confirmation', 'current_password', 'new_password',
        'token', 'captcha_token', 'credential', 'access_token', 'refresh_token',
    ];

    public function handle(Request $request, Closure $next)
    {
        // Skip logging sensitive routes or headers
        $sensitiveRoutes = [
            'api/admin/logs',
            'api/notifications/unread' // Example route to skip logging
        ];

        $isSensitiveRequest = in_array($request->path(), $sensitiveRoutes);
        if (!$isSensitiveRequest) {
            Log::info('📥 Incoming Request', [
                'method' => $request->method(),
                'url' => $request->fullUrl(),
                'ip' => $request->ip(),
                'headers' => $this->withoutSecrets($request->headers->all(), self::SECRET_HEADERS),
                'body' => $this->withoutSecrets($request->except(array_keys($request->allFiles())), self::SECRET_FIELDS),
            ]);
        }

        $started = microtime(true);
        $response = $next($request);

        if (!$isSensitiveRequest) {
            Log::info('📤 Outgoing Response', [
                'status' => $response->getStatusCode(),
                'ms' => (int) round((microtime(true) - $started) * 1000),
                'content' => $this->logResponseContent($response),
            ]);
        }

        return $response;
    }

    /** Replaces the named keys, at any depth, case-insensitively. */
    private function withoutSecrets(array $values, array $secrets): array
    {
        foreach ($values as $key => $value) {
            if (is_string($key) && in_array(strtolower($key), $secrets, true)) {
                $values[$key] = '[redacted]';
            } elseif (is_array($value)) {
                $values[$key] = $this->withoutSecrets($value, $secrets);
            }
        }

        return $values;
    }

    private function logResponseContent($response)
    {
        if (method_exists($response, 'getContent')) {
            $raw = (string) $response->getContent();
            if (strlen($raw) > self::MAX_LOGGED_RESPONSE_BYTES && $response->getStatusCode() < 400) {
                return '[' . strlen($raw) . ' bytes]';
            }
            $content = json_decode($raw, true);
            return is_array($content) ? $this->withoutSecrets($content, self::SECRET_FIELDS) : 'Non-JSON response';
        }

        return 'Non-JSON response';
    }
}
