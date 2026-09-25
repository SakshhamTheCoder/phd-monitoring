<?php

namespace App\Pages;

use App\Models\User;

/**
 * A scholar's own courses: the ones they are taking and the ones they have
 * finished, each tab read whole from GET /courses/student/my-courses. The
 * grade is shown only for finished courses, where there is one.
 */
final class MyCoursesPage extends PageDefinition
{
    private const COLUMNS = [
        ['key' => 'course_name', 'title' => 'Course'],
        ['key' => 'course_code', 'title' => 'Course code'],
        ['key' => 'department_name', 'title' => 'Department'],
        ['key' => 'credits', 'title' => 'Credits'],
        ['key' => 'semester', 'title' => 'Semester'],
    ];

    public function allows(User $user): bool
    {
        return $user->current_role?->role === 'student';
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('My courses', null, [
            'tabs' => [
                ['value' => 'ongoing', 'label' => 'Ongoing courses', 'table' => self::table('enrolled', 'No ongoing courses', self::COLUMNS)],
                ['value' => 'past', 'label' => 'Past courses', 'table' => self::table('completed', 'No past courses', [
                    ...self::COLUMNS,
                    ['key' => 'grade', 'title' => 'Grade', 'empty' => 'N/A'],
                ])],
            ],
        ]);
    }

    private static function table(string $status, string $empty, array $columns): array
    {
        return [
            'kind' => 'local',
            'endpoint' => "/courses/student/my-courses?status={$status}",
            'loading' => 'Loading your courses',
            'failed' => 'Could not load your courses. Check your connection and try again.',
            'empty_title' => $empty,
            'columns' => $columns,
            'actions' => [],
        ];
    }
}
