<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Traits\ProjectAuthorizes;
use App\Models\PositionApplication;
use App\Models\Project;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;

/**
 * Streams uploads off the private 'local' disk. Every route here sits behind
 * auth:sanctum: the reported hole was anonymous access, and closing that is
 * this pass's job. See download() for what auth:sanctum alone does not cover.
 */
class FileDownloadController extends Controller
{
    use ProjectAuthorizes;

    /**
     * GET /api/files/download/{path}: generic form-attachment download.
     *
     * ponytail: auth:sanctum proves the requester is logged in, not that they
     * own this particular record. A logged-in user who knows or guesses another
     * scholar's path can still fetch it. Ceiling: acceptable for this pass,
     * since it removes the anonymous internet-wide exposure the audit flagged.
     * Upgrade path: short-lived signed URLs minted by the endpoint that already
     * authorizes the form (URL::temporarySignedRoute), replacing this route.
     */
    public function download($path)
    {
        $relative = $this->resolvePrivateUploadPath($path);
        if (!$relative) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return Storage::disk('local')->response($relative);
    }

    /**
     * GET /api/applications/{applicationId}/resume: the worst case in the
     * audit (a resume, contact details and a cover note), so this reuses the
     * exact owns() check PositionApplicationController::index already applies
     * to the same data instead of falling back to the generic gate above.
     */
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

    /**
     * Reduce a stored path (or a requested one) to a path relative to the
     * 'local' disk root, refusing anything that is not really inside its
     * uploads/ folder. realpath() collapses '..' and symlinks, so a traversal
     * attempt or an absolute path smuggled in resolves outside the uploads
     * root and gets rejected here rather than trusted.
     */
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

        // Return the realpath-derived relative path, not the raw input, so a
        // harmless-but-unresolved '..' segment can never reach Storage/Flysystem.
        return 'uploads' . str_replace(DIRECTORY_SEPARATOR, '/', substr($full, strlen($root)));
    }
}
