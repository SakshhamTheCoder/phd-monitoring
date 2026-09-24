<?php

namespace App\Pages;

/** Every page described by the server, by the name GET /views/{page} takes. */
final class Pages
{
    private const PAGES = [
        'areas-of-specialization' => AreasPage::class,
        'clerks' => ClerksPage::class,
        'courses' => CoursesPage::class,
        'departments' => DepartmentsPage::class,
        'faculty' => FacultyPage::class,
        'outside-experts' => OutsideExpertsPage::class,
        'students' => StudentsPage::class,
        'users' => UsersPage::class,
    ];

    public static function find(string $name): ?PageDefinition
    {
        $class = self::PAGES[$name] ?? null;
        return $class ? new $class() : null;
    }
}
