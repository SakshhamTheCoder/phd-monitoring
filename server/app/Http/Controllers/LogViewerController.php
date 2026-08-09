<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LogViewerController extends Controller
{
    private const CHUNK = 65536;

    /**
     * Reads laravel.log by byte offset. A log is read from its end, so a request
     * with no offset returns the tail; the client then asks only for what has
     * been appended since, or for the chunk before what it already holds.
     */
    public function fetchLogs(Request $request)
    {
        if (optional(Auth::user()->current_role)->role !== 'admin') {
            return response()->json(['message' => 'You do not have permission to view logs'], 403);
        }

        $filePath = storage_path('logs/laravel.log');
        if (!file_exists($filePath)) {
            return $this->empty(0, 0);
        }

        clearstatcache(true, $filePath);
        $size = filesize($filePath);
        if ($size === 0) {
            return $this->empty(0, 0);
        }

        $direction = $request->query('direction', 'tail');
        $offset = $request->query('offset');
        $offset = $offset === null ? null : max(0, min((int) $offset, $size));

        // No offset, or the file was rotated or truncated under us.
        if ($offset === null || $direction === 'tail') {
            return $this->read($filePath, max(0, $size - self::CHUNK), $size, $size, true);
        }

        if ($direction === 'backward') {
            if ($offset <= 0) return $this->empty(0, $size);
            return $this->read($filePath, max(0, $offset - self::CHUNK), $offset, $size, true);
        }

        // Forward: only what is new. Almost always nothing, which is the point.
        if ($offset >= $size) return $this->empty($size, $size);
        return $this->read($filePath, $offset, min($size, $offset + self::CHUNK), $size, false);
    }

    private function read($filePath, $from, $to, $size, $trimPartialFirstLine)
    {
        $length = $to - $from;
        if ($length <= 0) return $this->empty($to, $size);

        $handle = fopen($filePath, 'r');
        if ($handle === false) return $this->empty($to, $size);

        fseek($handle, $from);
        $logs = fread($handle, $length);
        fclose($handle);

        // Reading from an arbitrary byte lands mid-line; drop that fragment so
        // the first entry rendered is a whole one.
        if ($trimPartialFirstLine && $from > 0) {
            $break = strpos($logs, "\n");
            if ($break !== false) {
                $from += $break + 1;
                $logs = substr($logs, $break + 1);
            }
        }

        return response()->json([
            'logs' => $logs,
            'from' => $from,
            'to' => $to,
            'size' => $size,
        ]);
    }

    private function empty($at, $size)
    {
        return response()->json(['logs' => '', 'from' => $at, 'to' => $at, 'size' => $size]);
    }
}
