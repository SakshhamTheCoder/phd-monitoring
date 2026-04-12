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
}