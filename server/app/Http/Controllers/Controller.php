<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * The form a request names, read by parameter name rather than position.
     *
     * Every form is reachable two ways: /forms/{type}/{form_id} for a role
     * working through their own queue, and /students/{id}/forms/{type}/{form_id}
     * for someone reading a scholar's record. The second nests the scholar
     * ahead of the form, so a controller taking the form id as its first
     * argument is handed the roll number there instead and finds no form.
     */
    protected function formIdFrom(Request $request, $fallback = null)
    {
        return $request->route('form_id') ?? $fallback;
    }
}
