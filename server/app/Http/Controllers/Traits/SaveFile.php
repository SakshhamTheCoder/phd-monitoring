<?php
namespace App\Http\Controllers\Traits;

use Illuminate\Support\Facades\Storage;

trait SaveFile
{
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
     * Delete a previously stored upload from disk. Safe to call with an empty
     * value, a placeholder ('#'), or an external URL — those are skipped. Any
     * failure is swallowed so cleanup can never break the surrounding request.
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
        }
    }

    /**
     * Store a new upload and remove the old one it replaces (if any).
     * Use this in "update" flows instead of saveUploadedFile to avoid orphans.
     */
    private function replaceUploadedFile($oldPath, $file, $formName, $rollNo)
    {
        $newPath = $this->saveUploadedFile($file, $formName, $rollNo);
        $this->deleteStoredFile($oldPath);
        return $newPath;
    }
}