<?php

namespace App\Pages;

use App\Http\Controllers\PositionApplicationController;
use App\Http\Controllers\ProjectController;
use App\Http\Controllers\ProjectPositionController;
use App\Models\FeatureFlag;
use App\Models\User;
use App\Support\Badge;

/**
 * A project's recruitment (params.id): the positions it has posted and, for
 * the PI, who applied to each and what has been decided. Every figure, badge
 * and choice is phrased here; posting, closing and deciding go to the
 * position and application endpoints, and the page is read again after each.
 */
final class ProjectRecruitmentPage extends PageDefinition
{
    public const POSITION_TYPES = ['JRF', 'SRF', 'Research Associate', 'Research Intern', 'UG Intern', 'PG Intern'];

    private const EMPTY = 'N/A';

    public function allows(User $user): bool
    {
        return FeatureFlag::enabled('project_management') && FeatureFlag::enabled('job_openings') && $user->may('can_manage_projects');
    }

    public function view(User $user, array $params = []): array
    {
        $id = $params['id'] ?? 0;
        $answer = app(ProjectController::class)->show($id);
        if (in_array($answer->getStatusCode(), [403, 404], true)) {
            return self::page('Project not found.', null, ['id' => null]);
        }
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        $project = $answer->getData(true);
        $canEdit = $project['can_edit'] !== false;
        $read = fn ($response) => $response->getStatusCode() === 200 ? json_decode(json_encode($response->getData()), true) : [];
        $positions = $read(app(ProjectPositionController::class)->index($id));
        // Applicants hand their details to the PI, not the department.
        $applications = $read(app(PositionApplicationController::class)->index($id));
        $title = (string) $project['title'];

        return self::page('Recruitment: ' . (mb_strlen($title) > 50 ? mb_substr($title, 0, 50) . '...' : $title), 'Manage positions and applications for this project.', [
            'id' => $project['id'],
            'page_class' => 'reveal',
            'back' => ['label' => 'Back to project', 'path' => "/projects/{$project['id']}"],
            'can_edit' => $canEdit,
            'post' => 'Post opening',
            'position_types' => self::POSITION_TYPES,
            'positions' => array_map(fn ($p) => self::position($p, $canEdit), $positions),
            'applications' => array_map(fn ($a) => self::application($a), $applications),
            // The decisions on an application, in the order it moves through them.
            'decisions' => [
                ['label' => 'Shortlist', 'status' => 'Shortlisted', 'variant' => 'secondary'],
                ['label' => 'Interview', 'status' => 'Interview Scheduled', 'variant' => 'secondary'],
                ['label' => 'Select', 'status' => 'Selected', 'variant' => 'success'],
                ['label' => 'Reject', 'status' => 'Rejected', 'variant' => 'danger-outline'],
            ],
            'none' => ['title' => 'No positions posted yet.', 'hint' => $canEdit ? 'Click "Post opening" to create one.' : null],
        ]);
    }

    private static function position(array $p, bool $canEdit): array
    {
        $status = ($p['status'] ?? '') ?: 'Open';
        $closed = $status === 'Closed';
        $applicants = $p['applications_count'] ?? $p['applicants'] ?? 0;

        return [
            'id' => $p['id'],
            'type' => $p['type'],
            'title' => $p['title'],
            'status' => $status,
            'badge' => Badge::of($status),
            'deadline' => $p['deadline'],
            'toggle' => $closed
                ? ['label' => 'Reopen position', 'icon' => 'fa-unlock', 'status' => 'Open', 'done' => 'Position reopened.']
                : ['label' => 'Close position', 'icon' => 'fa-lock', 'status' => 'Closed', 'done' => 'Position closed to new applications.'],
            'stats' => [
                ['label' => 'Filled', 'value' => [(string) ($p['selected_count'] ?? $p['selected'] ?? 0), ' / ', (string) $p['openings']]],
                ['label' => 'Stipend', 'value' => [($p['stipend'] ?? '') ?: self::EMPTY]],
                ['label' => 'Applicants', 'value' => [(string) $applicants]],
                ['label' => 'Shortlisted', 'value' => [(string) ($p['shortlisted_count'] ?? $p['shortlisted'] ?? 0)]],
            ],
            'delete' => "Delete the position \"{$p['title']}\"" . ($applicants ? ' and its ' . ($applicants === 1 ? '1 application' : "{$applicants} applications") : '') . '? This cannot be undone.',
            // The values the edit form starts from, as the position holds them.
            'form' => [
                'type' => $p['type'], 'title' => $p['title'], 'openings' => $p['openings'], 'status' => $status,
                'eligibility' => $p['eligibility'], 'skills' => $p['skills'], 'cgpa' => $p['min_cgpa'],
                'stipend' => $p['stipend'], 'deadline' => $p['deadline'], 'description' => $p['description'],
                'advertisementPath' => $p['advertisement_path'],
            ],
        ];
    }

    private static function application(array $a): array
    {
        $resume = $a['resume_path'] ?? '';
        return [
            'id' => $a['id'],
            'position_id' => $a['position_id'],
            'name' => $a['name'],
            'initials' => implode('', array_map(fn ($word) => mb_substr($word, 0, 1), explode(' ', (string) $a['name']))),
            'institute' => $a['institute'],
            'degree' => $a['degree'],
            'cgpa' => $a['cgpa'],
            'status' => $a['status'],
            'badge' => Badge::of($a['status']),
            'unconfirmed' => ($a['email_verified_at'] ?? null) === null ? 'Unconfirmed email' : null,
            'facts' => array_values(array_filter([
                ['label' => 'Email', 'value' => ($a['email'] ?? '') ?: self::EMPTY],
                ['label' => 'Phone', 'value' => ($a['phone'] ?? '') ?: self::EMPTY],
                ['label' => 'Applied for', 'value' => $a['position']['type'] ?? ($a['position_type'] ?? null)],
                ['label' => 'CGPA', 'value' => $a['cgpa']],
                ['label' => 'Degree', 'value' => $a['degree']],
                ['label' => 'Institute', 'value' => $a['institute']],
                ['label' => 'Applied on', 'date' => $a['applied_date']],
                ['label' => 'Research interest', 'value' => $a['research'], 'full' => true],
                ['label' => 'Skills', 'value' => implode(', ', $a['skills'] ?? []), 'full' => true],
                ($a['cover_note'] ?? null) ? ['label' => 'Cover note', 'value' => $a['cover_note'], 'full' => true, 'class' => 'pr-cover-note'] : null,
            ])),
            'resume' => $resume ? ['name' => basename($resume), 'path' => $resume] : null,
        ];
    }
}
