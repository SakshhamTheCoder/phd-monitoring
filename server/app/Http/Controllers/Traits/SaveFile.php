<?php
namespace App\Http\Controllers\Traits;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

trait SaveFile
{
    /**
     * Paths waiting to be removed from disk once the write that supersedes them
     * has actually been saved. Deleting earlier means a failed save leaves the
     * row pointing at a file that no longer exists, which loses the document
     * outright rather than merely leaving an orphan behind.
     */
    private $filesPendingDeletion = [];

    private function saveUploadedFile($file, $formName, $rollNo)
    {
        // Generate a random 6-digit number
        $randomNumber = date('YmdHis') . mt_rand(1000, 9999);

        // Define the file name format
        $fileName = "{$formName}_{$rollNo}_{$randomNumber}." . $file->getClientOriginalExtension();

        // Define the folder path for the form type
        $folderPath = "uploads/{$formName}/";

        // Store the file
        $filePath = $file->storeAs($folderPath, $fileName, 'public');

        // Return the relative URL to access the file (starting with /storage/)
        return '/app/public/' . $filePath; // This ensures the path starts with /storage/
    }

    /**
     * Store a new upload and queue the one it replaces for removal.
     * Use this in "update" flows instead of saveUploadedFile to avoid orphans.
     * The old file survives until commitFileDeletions() is called, so the caller
     * must call that once the new path has been persisted.
     */
    private function replaceUploadedFile($oldPath, $file, $formName, $rollNo)
    {
        $newPath = $this->saveUploadedFile($file, $formName, $rollNo);
        $this->queueFileDeletion($oldPath);
        return $newPath;
    }

    /**
     * Mark a stored upload for removal. Nothing touches the disk until
     * commitFileDeletions() runs, so an abandoned request leaves the file intact.
     */
    private function queueFileDeletion($storedPath)
    {
        if (!empty($storedPath)) {
            $this->filesPendingDeletion[] = $storedPath;
        }
    }

    /**
     * Remove the queued files. Call this only after the row that replaced them
     * has been saved, so a failure part way through cannot strand a live record
     * without its file.
     */
    private function commitFileDeletions()
    {
        $paths = $this->filesPendingDeletion;
        $this->filesPendingDeletion = [];
        foreach ($paths as $path) {
            $this->deleteStoredFile($path);
        }
    }

    /**
     * Drop the queue without touching the disk, for when the write failed.
     * The superseded files stay where they are and remain reachable from the row.
     */
    private function discardFileDeletions()
    {
        $this->filesPendingDeletion = [];
    }

    /**
     * Delete a stored upload from disk. Safe to call with an empty value, a
     * placeholder ('#'), or an external URL, since those are skipped. Any failure
     * is logged and swallowed so cleanup can never break the surrounding request.
     */
    private function deleteStoredFile($storedPath)
    {
        if (empty($storedPath) || $storedPath === '#') {
            return;
        }
        if (preg_match('#^https?://#i', $storedPath)) {
            return; // external link, not a file we own
        }
        $relative = preg_replace('#^/?app/public/#', '', $storedPath);
        try {
            if ($relative && Storage::disk('public')->exists($relative)) {
                Storage::disk('public')->delete($relative);
            }
        } catch (\Throwable $e) {
            // Cleanup is best-effort; never fail the request over an orphan file.
            Log::warning('Could not delete superseded upload ' . $storedPath . ': ' . $e->getMessage());
        }
    }
}
