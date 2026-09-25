<?php

namespace App\Pages;

use App\Http\Controllers\ClerkController;
use App\Http\Controllers\CourseController;
use App\Http\Controllers\StudentController;
use App\Http\Controllers\StudentCourseController;
use App\Models\User;
use App\Support\Navigation;

/**
 * A PhD scholar's profile: their research under their name with the progress
 * ring beside it, their details, their own account of themselves, the people
 * around them, their publications and their courses. The scholar's own at
 * /home, anyone's at /students/{roll_no}. What the reader may do with it is
 * the profile endpoint's answer (can_edit, can_manage, can_tag_courses).
 */
final class StudentProfilePage extends PageDefinition
{
    // Up to the scholar, or whoever edits their record, to fill in.
    private const ABOUT_EMPTY_SELF = 'Not filled in yet. Edit your profile to add it.';

    private const TEXT_LIMIT = 5000;

    public function allows(User $user): bool
    {
        // The profile endpoint decides whom it answers, per scholar.
        return true;
    }

    public function view(User $user, array $params = []): array
    {
        $roll = $params['roll_no'] ?? null;
        $students = app(StudentController::class);
        $answer = $roll ? $students->get(request(), $roll) : $students->me();
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        $envelope = self::read($answer);
        $profile = $envelope['profile'];
        $roll = (string) $profile['roll_no'];
        $isSelf = !empty($envelope['is_self']);
        // The scholar's key where the course endpoints take one, as the profile page read it.
        $studentId = ($profile['database_id'] ?? null) ?: $profile['id'];
        $locked = !empty($profile['phd_title_locked']);
        // Tentative until the IRB is actually approved.
        $titleLabel = !empty($profile['irb_completed']) ? 'PhD Title' : 'Tentative PhD Title';

        // Each hangs off the scholar on the same gate as the profile; a section
        // the reader may not read is left out rather than reported.
        $courses = self::readIfAllowed(fn () => app(StudentCourseController::class)->getCoursesForStudent($studentId))['data'] ?? [];
        $attendance = self::readIfAllowed(fn () => app(ClerkController::class)->studentAttendance(request(), $roll));
        $publications = self::readIfAllowed(fn () => $students->publications(request(), $roll));
        $mayTag = !empty($envelope['can_tag_courses']);

        return self::page((string) $profile['name'], null, [
            'loading' => 'Loading profile',
            'actions' => array_values(array_filter([
                // One filled button: View forms for someone reading another
                // scholar's profile, until Save takes that place while editing.
                $isSelf ? null : ['label' => 'View forms', 'navigate' => "/students/{$roll}/forms", 'editing_variant' => 'secondary'],
                $isSelf ? null : ['label' => 'View progress monitoring', 'variant' => 'secondary', 'navigate' => "/students/{$roll}/forms/presentation"],
                $mayTag ? self::action('Tag course', 'tag-course', 'secondary') : null,
                // The request is refused without this capability, so it is only offered with it.
                !empty(Navigation::capabilities($user)['can_propose_supervisor_changes']) ? self::action('Manage supervisors/doctoral', 'supervisors', 'secondary') : null,
                Navigation::allows($user, 'admin') && !$isSelf ? ['label' => 'Manage forms', 'variant' => 'secondary', 'navigate' => "/forms/manage?roll_no={$roll}"] : null,
                !empty($envelope['can_edit']) ? ['edit' => true] : null,
            ])),
            // can_edit covers the scholar's own profile and those who manage
            // scholars, as the save endpoint does.
            'edit' => !empty($envelope['can_edit']) ? [
                'values' => array_map(fn ($key) => $profile[$key] ?: '', array_combine(self::EDITED, self::EDITED)),
                // The title and its description are frozen once the IRB is constituted.
                'sent_without' => $locked ? ['phd_title', 'tentative_desc'] : [],
                'request' => ['method' => 'POST', 'path' => "/students/{$roll}/profile", 'done' => 'Profile updated successfully', 'failure' => 'both', 'failed' => 'Failed to update profile', 'loader' => false],
                'save_state' => 'disabled',
                'confirm_discard' => 'Discard your unsaved changes to this profile?',
            ] : null,
            'sections' => array_values(array_filter([
                [
                    'kind' => 'profile',
                    'progress' => (int) ($profile['overall_progress'] ?? 0),
                    'boxed' => true,
                    'lines' => [
                        ['label' => $titleLabel, 'title' => true, 'text' => $profile['phd_title']],
                        ['label' => 'Domain', 'text' => $profile['broad_area']],
                        ['label' => 'Description', 'text' => $profile['tentative_desc']],
                    ],
                    'locked_note' => $locked ? 'Locked, IRB constituted' : null,
                    // While editing, the research lines become their fields. The
                    // domain is chosen on the supervisor allocation form, so it
                    // only reports here.
                    'edit_lines' => [
                        ['kind' => 'input', 'id' => 'profile-card-title', 'label' => $titleLabel, 'field' => 'phd_title', 'placeholder' => 'Enter your Ph.D. title', 'disabled' => $locked, 'note' => $locked ? 'Locked. IRB constitution form already submitted.' : null],
                        ['kind' => 'text', 'label' => 'Domain', 'text' => $profile['broad_area'], 'empty' => 'Set on your supervisor allocation form'],
                        ['kind' => 'textarea', 'id' => 'profile-card-description', 'label' => 'Description', 'field' => 'tentative_desc', 'placeholder' => 'Briefly describe your proposed research topic, objectives and methodology', 'disabled' => $locked, 'max' => self::TEXT_LIMIT],
                    ],
                    'rows' => self::details($user, $profile, $attendance),
                ],
                ['kind' => 'about', 'title' => 'About the scholar', 'items' => [
                    ['kind' => 'textarea', 'id' => 'profile-strengths', 'label' => 'Strengths', 'field' => 'strengths', 'text' => $profile['strengths'], 'empty' => $isSelf ? self::ABOUT_EMPTY_SELF : null, 'placeholder' => 'What you are good at, and what you have got better at so far', 'max' => self::TEXT_LIMIT],
                    ['kind' => 'textarea', 'id' => 'profile-help-needed', 'label' => 'Help needed', 'field' => 'help_needed', 'text' => $profile['help_needed'], 'empty' => $isSelf ? self::ABOUT_EMPTY_SELF : null, 'placeholder' => 'Where you are stuck, and what would help: training, equipment, a collaborator, time', 'max' => self::TEXT_LIMIT],
                ]],
                self::people('Supervisors', $profile['supervisors'] ?? []),
                self::people('Doctoral committee', $profile['doctoral'] ?? []),
                // Set from Manage supervisors/doctoral.
                [
                    'kind' => 'table',
                    'title' => 'IRB outside expert',
                    'columns' => self::columns(['name' => 'Name', 'email' => 'Email', 'designation' => 'Designation', 'institution' => 'Institution']),
                    'rows' => $profile['irb_outside_expert'] ? [$profile['irb_outside_expert']] : [],
                    'empty_note' => 'None on record. The revised IRB goes from the supervisors straight to the doctoral committee, with no external review.',
                ],
                // Read-only here: the scholar's publications page is the one place that writes them.
                $publications !== null ? ['kind' => 'publications', 'data' => $publications] : null,
                self::courses('Enrolled courses', $courses, 'enrolled', $mayTag),
                self::courses('Completed courses', $courses, 'completed', $mayTag),
            ])),
            'dialogs' => array_filter([
                'tag-course' => $mayTag ? [
                    'block' => 'course-tag',
                    'props' => [
                        'courses' => array_map(fn ($course) => ['title' => "{$course['course_code']} - {$course['course_name']}", 'value' => $course['id']], self::readIfAllowed(fn () => app(CourseController::class)->getAllCourses(request()))['data'] ?? []),
                        'request' => ['method' => 'POST', 'path' => '/courses/student/tag', 'body' => ['student_id' => $studentId], 'done' => 'Course tagged successfully', 'failed' => 'Failed to tag course', 'loader' => false],
                    ],
                ] : null,
                'supervisors' => [
                    'block' => 'supervisor-doctoral-manager',
                    'row' => ['roll_no' => $roll, 'supervisors' => $profile['supervisors'] ?? [], 'doctoral' => $profile['doctoral'] ?? []],
                    'props' => [
                        'outside_expert' => $profile['irb_outside_expert'],
                        'can_set_outside_expert' => !empty($envelope['can_manage']),
                        // The profile shows who was changed as soon as the dialog closes.
                        'reload_on_close' => true,
                    ],
                ],
            ]) ?: (object) [],
        ]);
    }

    private const EDITED = ['phone', 'address', 'fathers_name', 'phd_title', 'tentative_desc', 'strengths', 'help_needed', 'cgpa'];

    /** The detail grid under the name, every value phrased here. */
    private static function details(User $user, array $profile, ?array $attendance): array
    {
        $window = $profile['thesis_window'] ?? null;

        return array_values(array_filter([
            ['label' => 'Roll Number', 'value' => $profile['roll_no']],
            ['label' => 'Email', 'value' => $profile['email']],
            ['label' => 'Phone', 'value' => $profile['phone'], 'field' => 'phone'],
            ['label' => 'Department', 'value' => $profile['department']],
            ['label' => 'CGPA', 'value' => $profile['cgpa'], 'field' => 'cgpa'],
            // What the synopsis waits on; the required figure is set per status by an admin.
            ['label' => 'Coursework', 'boxed' => ($profile['completed_credits'] ?? 0) . " of {$profile['required_credits']} credits"],
            ['label' => "Father's Name", 'value' => $profile['fathers_name'], 'field' => 'fathers_name'],
            ['label' => 'Address', 'value' => $profile['address'], 'field' => 'address'],
            ['label' => 'Current Status', 'value' => $profile['current_status']],
            // Read-only: it moves the thesis deadline.
            ['label' => 'Physically Handicapped', 'value' => $profile['physically_handicapped'] ? 'Yes' : 'No'],
            // Where the stipend comes from. Nobody having said is not No.
            ['label' => 'JRF', 'value' => $profile['is_jrf'] === null ? null : ($profile['is_jrf'] ? 'Yes' : 'No')],
            ['label' => 'NET/GATE', 'value' => $profile['net_gate'] ?: null],
            ['label' => 'Date of Admission', 'date' => $profile['date_of_registration']],
            ['label' => 'Date of IRB', 'date' => $profile['date_of_irb']],
            ['label' => 'Date of Synopsis', 'date' => $profile['date_of_synopsis']],
            ['label' => 'Date of Thesis', 'date' => $profile['date_of_thesis']],
            // The award is a later and separate event from the submission.
            ['label' => 'Date of Thesis Awarded', 'date' => $profile['date_of_thesis_awarded']],
            $window ? ['label' => 'Thesis Deadline', 'deadline' => [
                'date' => $window['latest'],
                'due' => $window['days_remaining'] <= 30,
                'note' => self::deadlineNote($window),
            ]] : null,
            $attendance ? ['label' => 'Attendance', 'span' => 'all', 'attendance' => self::attendance($user, (string) $profile['roll_no'], $attendance)] : null,
        ]));
    }

    /** What the deadline means today. */
    private static function deadlineNote(array $window): string
    {
        $granted = (int) $window['extensions_granted'];
        $extended = $granted > 0 ? ", {$granted} extension" . ($granted > 1 ? 's' : '') . ' granted' : '';
        $daysLeft = (int) $window['days_remaining'];
        return $daysLeft < 0 ? '(overdue by ' . abs($daysLeft) . " days{$extended})" : "({$daysLeft} days left{$extended})";
    }

    /**
     * The all-time figure, this month's behind it on hover, and a way through
     * to the attendance page for the roles that have one. A date range belongs
     * on that page. The HOD's is the leave requests they approve.
     */
    private static function attendance(User $user, string $roll, array $attendance): array
    {
        $all = $attendance['summary'];
        $month = $attendance['current_month'] ?? null;

        return [
            'value' => $all['total'] > 0 ? "{$all['present']}/{$all['total']} ({$all['percent']}%)" : null,
            'month_title' => ($month['label'] ?? 'Current month') . ' attendance',
            'month_lines' => $month && $month['total'] > 0
                ? ["{$month['present']} Present / {$month['total']} Sessions", "{$month['percent']}%"]
                : ['No sessions recorded this month.'],
            'link' => Navigation::allows($user, 'attendance') ? [
                'label' => $user->current_role?->role === 'hod' ? 'Leave requests' : 'View attendance',
                'navigate' => "/attendance?roll_no={$roll}",
            ] : null,
        ];
    }

    private static function people(string $title, array $people): array
    {
        return [
            'kind' => 'table',
            'title' => $title,
            'columns' => self::columns(['name' => 'Name', 'email' => 'Email', 'phone' => 'Phone', 'designation' => 'Designation'], ['name' => 'faculty']),
            'rows' => array_map(fn ($person) => [
                'faculty_code' => $person['faculty_code'] ?? null,
                'name' => ($person['name'] ?? null) ?: self::EMPTY,
                'email' => ($person['email'] ?? null) ?: self::EMPTY,
                'phone' => ($person['phone'] ?? null) ?: self::EMPTY,
                'designation' => ($person['designation'] ?? null) ?: self::EMPTY,
            ], $people),
        ];
    }

    private const EMPTY = 'N/A';

    /**
     * A course tagged by mistake is taken off again by whoever may tag one;
     * the server holds each to their scope.
     */
    private static function courses(string $title, array $courses, string $status, bool $mayRemove): array
    {
        $columns = ['course_code' => 'Course code', 'course_name' => 'Course name', 'credits' => 'Credits', 'semester' => 'Semester'];
        if ($status === 'completed') {
            $columns['grade'] = 'Grade';
        }

        return array_filter([
            'kind' => 'table',
            'title' => $title,
            'columns' => array_merge(self::columns($columns), $mayRemove ? [['key' => 'remove', 'title' => 'Actions', 'cell' => 'remove']] : []),
            'rows' => array_values(array_filter($courses, fn ($course) => $course['status'] === $status)),
            'remove' => $mayRemove ? [
                'method' => 'DELETE',
                'path' => '/courses/student/remove/{id}',
                'confirm' => "Remove {course_code} from this scholar's courses?",
                'done' => 'Course removed.',
                'failure' => 'fetch',
                'loader' => false,
            ] : null,
        ], fn ($value) => $value !== null);
    }

    private static function columns(array $titles, array $cells = []): array
    {
        return array_map(fn ($key, $title) => array_filter(['key' => $key, 'title' => $title, 'cell' => $cells[$key] ?? null]), array_keys($titles), $titles);
    }

    private static function read($answer): array
    {
        return json_decode(json_encode($answer->getData()), true);
    }

    /** An endpoint's answer, or null where it refuses this reader. */
    private static function readIfAllowed(callable $call): ?array
    {
        try {
            $answer = $call();
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException) {
            return null;
        }
        return $answer->getStatusCode() === 200 ? self::read($answer) : null;
    }
}
