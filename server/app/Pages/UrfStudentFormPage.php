<?php

namespace App\Pages;

use App\Models\User;

/**
 * One URF form for a UG student (params.type, params.id), or a new
 * application (type new): which of the application, fellowship or report
 * forms is theirs to fill, which is read as filed, and why there is no form
 * where there is none. The forms themselves are drawn by the client.
 *
 * `body.kind` is one of apply, fellow, report, shell (read the filed form at
 * `path`) or notice (runs of text, a date as {date}).
 */
final class UrfStudentFormPage extends PageDefinition
{
    private const TITLES = [
        'application' => 'URF Application Form',
        'additional' => 'Additional Information Form',
    ] + UrfStudentFormsPage::REPORT_TYPES;

    public function allows(User $user): bool
    {
        return $user->may('can_apply_for_urf');
    }

    public function view(User $user, array $params = []): array
    {
        $type = (string) ($params['type'] ?? '');
        $mine = UrfStudentFormsPage::mine();
        $application = null;
        foreach ($mine['applications'] as $candidate) {
            if ((string) $candidate['id'] === (string) ($params['id'] ?? '')) {
                $application = $candidate;
            }
        }

        return self::page(
            $type === 'new' ? "Apply for URF {$mine['session']}" : (self::TITLES[$type] ?? ''),
            $application && $type !== 'new' ? "URF {$application['session']} · {$application['project_title']}" : null,
            ['body' => self::body($user, $type, $mine, $application)],
        );
    }

    private static function notice(array|string $text): array
    {
        return ['kind' => 'notice', 'text' => is_array($text) ? $text : [$text]];
    }

    private static function body(User $user, string $type, array $mine, ?array $application): array
    {
        if ($type === 'new') {
            return UrfStudentFormsPage::canApply($mine)
                ? ['kind' => 'apply', 'student' => $mine['student']]
                : self::notice($mine['applications_open'] ? "You have already applied for URF {$mine['session']}." : 'URF applications are closed right now.');
        }
        if (!$application) {
            return self::notice('This URF project was not found.');
        }

        if ($type === 'application') {
            // Not gated on the window being open: an application only sits on
            // the student once a step has sent it back, and closing applications
            // stops new ones rather than stranding that one. The second student
            // reads it; the first files it.
            $editable = $application['status'] === 'applied'
                && !UrfStudentFormsPage::locked($application)
                && $application['session'] === $mine['session']
                && strtolower((string) ($application['student2_email'] ?? '')) !== strtolower((string) $user->email);
            return $editable
                ? ['kind' => 'apply', 'initial' => $application, 'student' => $mine['student']]
                : ['kind' => 'shell', 'path' => "/urf/urf-application/{$application['id']}"];
        }

        if ($type === 'additional') {
            if ($application['status'] !== 'selected') {
                return self::notice('This form opens once your project is selected.');
            }
            $fellow = UrfStudentFormsPage::own($user, $application['fellows'] ?? [])[0] ?? null;
            if (UrfStudentFormsPage::locked($fellow)) {
                return ['kind' => 'shell', 'path' => "/urf/urf-additional-info/{$fellow['id']}"];
            }
            // Prefilled from the student's most recent other project.
            $previous = null;
            foreach ($mine['applications'] as $other) {
                if ($other['id'] !== $application['id'] && ($row = UrfStudentFormsPage::own($user, $other['fellows'] ?? [])[0] ?? null)) {
                    $previous = $row;
                    break;
                }
            }
            return ['kind' => 'fellow', 'application_id' => $application['id'], 'initial' => $fellow, 'prefill' => $previous];
        }

        if (isset(UrfStudentFormsPage::REPORT_TYPES[$type])) {
            if ($application['status'] !== 'selected') {
                return self::notice('Reports open once your project is selected.');
            }
            // One report per project per round, so whichever student filed it, both read it.
            $filed = UrfStudentFormsPage::filed($application, $type);
            if (UrfStudentFormsPage::locked($filed)) {
                return ['kind' => 'shell', 'path' => '/urf/' . UrfStudentFormsPage::REPORT_FORMS[$type] . "/{$filed['id']}"];
            }
            $round = UrfStudentFormsPage::windowFor($mine['report_windows'], $application, $type);
            if ($round['is_open'] ?? false) {
                return ['kind' => 'report', 'application' => $application, 'type' => $type, 'filed' => $filed];
            }
            // Which round it is, rather than a form the server would refuse.
            return self::notice(match (true) {
                !$round => 'This report has not been scheduled yet.',
                UrfStudentFormsPage::opensLater($round) => [['This report can be filed from ', ['date' => $round['opens_on']], ' to ', ['date' => $round['closes_on']], '.']],
                default => [['This report closed on ', ['date' => $round['closes_on']], '.']],
            });
        }

        return self::notice('This URF project was not found.');
    }
}
