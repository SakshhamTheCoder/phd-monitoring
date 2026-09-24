<?php

namespace App\Pages;

/** Every page described by the server, by the name GET /views/{page} takes. */
final class Pages
{
    private const PAGES = [
        'outside-experts' => OutsideExpertsPage::class,
    ];

    public static function find(string $name): ?PageDefinition
    {
        $class = self::PAGES[$name] ?? null;
        return $class ? new $class() : null;
    }
}
