<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

abstract class Controller
{
    /**
     * A route parameter read by name rather than by position.
     *
     * Most things here are reachable two ways: /forms/{type}/{form_id} for a
     * role working through their own queue, and
     * /students/{id}/forms/{type}/{form_id} for someone reading a scholar's
     * record. The second nests the scholar ahead of everything else, and
     * Laravel fills a controller's arguments in route order, so a method
     * declaring the form id first is handed the roll number there and finds
     * nothing. Reading by name is right on either path.
     */
    protected function routeParam(Request $request, string $name, $fallback = null)
    {
        return $request->route($name) ?? $fallback;
    }
}
