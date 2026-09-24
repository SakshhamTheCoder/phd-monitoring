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
        'form-list' => FormListPage::class,
        'outside-experts' => OutsideExpertsPage::class,
        'presentation-list' => PresentationListPage::class,
        'presentations' => PresentationsPage::class,
        'student-progress' => StudentProgressPage::class,
        'students' => StudentsPage::class,
        'urf' => UrfPage::class,
        'users' => UsersPage::class,
    ];

    public static function find(string $name): ?PageDefinition
    {
        // Each URF form's list is one page, named after the form.
        if (isset(UrfFormListPage::FORMS[$name])) {
            return new UrfFormListPage($name);
        }

        $class = self::PAGES[$name] ?? null;
        return $class ? new $class() : null;
    }
}
