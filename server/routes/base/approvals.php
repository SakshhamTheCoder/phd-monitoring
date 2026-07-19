<?php

use Illuminate\Support\Facades\Route;

/**
 * DEPRECATED: this route used to record accept/reject directly from a GET link, which is
 * unsafe (email scanners could auto-fire it) and captured no comment. It now simply
 * redirects to the secure review page, so links in already-sent emails still land safely.
 */
Route::get('/{key}', function ($key) {
    $base = rtrim(config('app.frontend_url'), '/');
    return redirect($base . '/external-review/' . $key);
});
