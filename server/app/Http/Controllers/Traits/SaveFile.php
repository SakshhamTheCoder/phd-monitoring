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

    /**
     * The only upload an anonymous applicant needs to see before they log in
     * or even apply. Everything else is scoped to one scholar or one PI and
     * has no business on the web-served disk.
     */
    private const PUBLIC_FORM = 'project_advertisement';

    private function saveUploadedFile($file, $formName, $rollNo)
    {
        // Generate a random 6-digit number
        $randomNumber = date('YmdHis') . mt_rand(1000, 9999);

        // Define the file name format
        $fileName = "{$formName}_{$rollNo}_{$randomNumber}." . $file->getClientOriginalExtension();

        // Define the folder path for the form type
        $folderPath = "uploads/{$formName}/";

        if ($formName === self::PUBLIC_FORM) {
            $filePath = $file->storeAs($folderPath, $fileName, 'public');
            return '/app/public/' . $filePath;
        }

        // 'local' disk roots at storage/app, outside the storage/public symlink,
        // so nothing here is reachable without going through an authorized route.
        $filePath = $file->storeAs($folderPath, $fileName, 'local');
        return '/app/' . $filePath;
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

        // The disk lives in the path itself: still-public uploads keep the
        // '/app/public/' prefix, everything moved private does not.
        if (preg_match('#^/?app/public/#', $storedPath)) {
            $disk = 'public';
            $relative = preg_replace('#^/?app/public/#', '', $storedPath);
        } else {
            $disk = 'local';
            $relative = preg_replace('#^/?app/#', '', $storedPath);
        }

        try {
            if ($relative && Storage::disk($disk)->exists($relative)) {
                Storage::disk($disk)->delete($relative);
            }
        } catch (\Throwable $e) {
            // Cleanup is best-effort; never fail the request over an orphan file.
            Log::warning('Could not delete superseded upload ' . $storedPath . ': ' . $e->getMessage());
        }
    }
}
