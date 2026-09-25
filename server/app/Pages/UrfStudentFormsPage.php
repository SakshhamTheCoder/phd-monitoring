<?php

namespace App\Pages;

use App\Http\Controllers\UrfController;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * A UG student's URF forms: one block per project, newest first, each with
 * the cards of that project's own forms, and whether a new application may
 * be made. A student applies once per session (calendar year), so last
 * year's selected project does not stop this year's application.
 *
 * The rules of which form is theirs to fill, which is read, and when a report
 * round is open live here, for this page and for each form (UrfStudentFormPage).
 */
final class UrfStudentFormsPage extends PageDefinition
{
    public const REPORT_TYPES = ['half_yearly' => 'Half-yearly Progress Report', 'final' => 'Final Report'];

    public const REPORT_FORMS = ['half_yearly' => 'urf-half-yearly-report', 'final' => 'urf-final-report'];

    public const REPORT_PATHS = ['half_yearly' => 'half-yearly-report', 'final' => 'final-report'];

    public function allows(User $user): bool
    {
        return $user->may('can_apply_for_urf');
    }

    public function view(User $user, array $params = []): array
    {
        $mine = self::mine();
        $session = $mine['session'];

        return self::page('Available forms', 'Undergraduate Research Fellowship', [
            'actions' => self::canApply($mine) ? [['label' => "Apply for URF {$session}", 'navigate' => '/forms/urf-application']] : [],
            'empty' => $mine['applications']
                ? null
                : ($mine['applications_open'] ? "You have not applied for URF {$session} yet." : 'URF applications are closed right now.'),
            'applications' => array_map(fn ($application) => [
                'id' => $application['id'],
                'title' => "URF {$application['session']} · {$application['project_title']}",
                'status' => ucfirst((string) $application['status']),
                'rounds' => self::roundNotices($application, $mine['report_windows']),
                'forms' => self::formsFor($user, $application, $mine['report_windows']),
            ], $mine['applications']),
        ]);
    }

    /** The student's URF standing, as GET /urf/mine answers it. */
    public static function mine(): array
    {
        $answer = app(UrfController::class)->mine();
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        return json_decode(json_encode($answer->getData()), true);
    }

    /** One application per session: open unless this year's is waiting or selected. */
    public static function canApply(array $mine): bool
    {
        if (!$mine['applications_open']) {
            return false;
        }
        foreach ($mine['applications'] as $application) {
            if ($application['session'] === $mine['session'] && $application['status'] !== 'rejected') {
                return false;
            }
        }
        return true;
    }

    /** The student's own rows of a per-student form, such as the fellowship details. */
    public static function own(User $user, array $rows): array
    {
        return array_values(array_filter($rows, fn ($row) => (string) $row['user_id'] === (string) $user->id));
    }

    /**
     * A form is the student's to fill while it waits on them. Submitting moves
     * it to the mentor, and from then on it is read rather than filled in.
     */
    public static function locked(?array $form): bool
    {
        return $form !== null && ($form['stage'] ?? null) !== 'student';
    }

    public static function windowFor(array $windows, array $application, string $type): ?array
    {
        foreach ($windows as $window) {
            if ($window['type'] === $type && (int) $window['session'] === (int) $application['session']) {
                return $window;
            }
        }
        return null;
    }

    public static function filed(array $application, string $type): ?array
    {
        foreach ($application['reports'] ?? [] as $report) {
            if ($report['type'] === $type) {
                return $report;
            }
        }
        return null;
    }

    /** Whether a round's first day is still ahead, counted from midnight UTC as the page did. */
    public static function opensLater(array $window): bool
    {
        return Carbon::parse($window['opens_on'], 'UTC')->startOfDay()->gt(now());
    }

    /** The rest wait on selection, and a report on its round being open as well. */
    private static function formsFor(User $user, array $application, array $windows): array
    {
        $base = "/forms/urf/{$application['id']}";
        $forms = [['form_type' => 'urf-application', 'form_name' => 'URF Application Form', 'path' => "{$base}/application"]];
        if ($application['status'] !== 'selected') {
            return $forms;
        }
        $forms[] = ['form_type' => 'urf-additional-info', 'form_name' => 'Additional Information Form', 'path' => "{$base}/additional-info", 'action_required' => !self::own($user, $application['fellows'] ?? [])];
        foreach (self::REPORT_TYPES as $type => $name) {
            $round = self::windowFor($windows, $application, $type);
            $filed = self::filed($application, $type) !== null;
            if (!($round['is_open'] ?? false) && !$filed) {
                continue;
            }
            $forms[] = ['form_type' => self::REPORT_FORMS[$type], 'form_name' => $name, 'path' => "{$base}/" . self::REPORT_PATHS[$type], 'action_required' => ($round['is_open'] ?? false) && !$filed];
        }
        return $forms;
    }

    /** The rounds a selected project's reports wait on, as runs of text, a date as {date}. */
    private static function roundNotices(array $application, array $windows): array
    {
        if ($application['status'] !== 'selected') {
            return [];
        }
        $notices = [];
        foreach (self::REPORT_TYPES as $type => $name) {
            $round = self::windowFor($windows, $application, $type);
            if (!$round || $round['is_open'] || self::filed($application, $type)) {
                continue;
            }
            $notices[] = array_values(array_filter([
                $name,
                ': ',
                self::opensLater($round) ? ['opens ', ['date' => $round['opens_on']]] : ['closed ', ['date' => $round['closes_on']]],
                $round['notes'] ? " · {$round['notes']}" : null,
            ]));
        }
        return $notices;
    }
}
