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

    /**
     * The answer to someone asking for what they may not have. Written once
     * here because the same line was copied into 98 places, and a refusal that
     * differs by a word between endpoints reads as a different problem.
     */
    protected function refuse(string $message = 'You are not authorized to access this resource')
    {
        return response()->json(['message' => $message], 403);
    }

    /**
     * The ids a request selected under one field, as a list.
     *
     * A body that leaves the field out reads as null, and counting or iterating
     * null is a TypeError rather than an empty selection. Nothing selected and
     * nothing sent mean the same thing here.
     */
    protected function selectedIds(Request $request, string $field): array
    {
        return (array) $request->input($field, []);
    }
}
