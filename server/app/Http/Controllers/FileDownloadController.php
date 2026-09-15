<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ProjectAuthorizes;
use App\Models\PositionApplication;
use App\Models\Project;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

class FileDownloadController extends Controller
{
    use ProjectAuthorizes;

    // ponytail: auth:sanctum only proves login, not ownership; upgrade to signed URLs (URL::temporarySignedRoute) if that's not tight enough.
    public function download($path)
    {
        $relative = $this->resolvePrivateUploadPath($path);
        if (!$relative) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return Storage::disk('local')->response($relative);
    }

    public function resume($applicationId)
    {
        $application = PositionApplication::find($applicationId);
        if (!$application) {
            return response()->json(['message' => 'Application not found'], 404);
        }

        $project = Project::find($application->project_id);
        if (!$project || !$this->owns(Auth::user(), $project)) {
            return response()->json(['message' => 'You do not have permission to view this resume. Contact your administrator if you believe this is a mistake.'], 403);
        }

        if (!$application->resume_path) {
            return response()->json(['message' => 'No resume on file'], 404);
        }

        $relative = $this->resolvePrivateUploadPath($application->resume_path);
        if (!$relative) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return Storage::disk('local')->response($relative);
    }

    // realpath() collapses '..'/symlinks so traversal attempts resolve outside uploads/ and get rejected.
    private function resolvePrivateUploadPath($path)
    {
        $relative = ltrim((string) preg_replace('#^/?app/#', '', $path), '/');
        if ($relative === '' || !str_starts_with($relative, 'uploads/')) {
            return null;
        }

        $root = realpath(Storage::disk('local')->path('uploads'));
        $full = realpath(Storage::disk('local')->path($relative));
        if (!$root || !$full || !str_starts_with($full, $root . DIRECTORY_SEPARATOR)) {
            return null;
        }

        // Uses the realpath-derived path, not raw input, so a stray '..' can't reach Storage/Flysystem.
        return 'uploads' . str_replace(DIRECTORY_SEPARATOR, '/', substr($full, strlen($root)));
    }
}
