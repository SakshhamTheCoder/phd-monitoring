<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;

/**
 * Moves the uploads already on the public disk to private storage, so the
 * deploy that ships the private disk also closes the old public URLs.
 *
 * The move itself is uploads:make-private. A file that fails to copy stops it
 * before any path is rewritten, and the app reads both locations, so a
 * failure here is logged rather than stopping the deploy; run the command by
 * hand afterwards to finish.
 */
return new class extends Migration
{
    public function up(): void
    {
        $status = Artisan::call('uploads:make-private');
        if ($status !== 0) {
            Log::error('uploads:make-private did not finish during migrate; run it by hand. ' . Artisan::output());
        }
    }

    public function down(): void
    {
        // Files stay private: putting them back on the public disk would
        // reopen them to anyone with the URL.
    }
};
