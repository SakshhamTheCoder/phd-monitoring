<?php

namespace App\Pages;

use App\Http\Controllers\ProjectController;
use App\Models\Faculty;
use App\Models\FeatureFlag;
use App\Models\User;
use App\Projects\ProjectWizard;
use App\Support\ProjectBudget;
use App\Support\ProjectDuration;

/**
 * The project proposal wizard, new or editing one project (params.id): its
 * steps and what each asks, the options it offers, the investigator it is
 * filed under and the values it starts from. The review step and the save
 * are the server's too (ProjectWizardController), so a client only draws.
 */
final class ProjectWizardPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return FeatureFlag::enabled('project_management') && $user->may('can_manage_projects');
    }

    public function view(User $user, array $params = []): array
    {
        $id = ($params['id'] ?? null) ?: null;
        $project = null;
        $budget = null;
        if ($id) {
            $answer = app(ProjectController::class)->show($id);
            abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
            $project = json_decode(json_encode($answer->getData()), true);
            $budget = $answer->getData()->budget ?? null;
            // Only the project's own writers may edit it.
            abort_unless(!empty($project['can_edit']), 403);
        }

        return self::page($id ? 'Edit project' : 'Create new project proposal', null, [
            'page_class' => $id ? 'reveal' : null,
            'badge' => $id ? 'Editing' : 'Draft',
            'back' => 'Back to projects',
            'leave' => 'Leave this page? ' . ($id ? 'Your unsaved changes to this project will be lost.' : 'The project details you have entered will be lost.'),
            'steps' => ProjectWizard::steps(),
            'values' => $project ? ProjectWizard::valuesFrom($project, $budget) : ProjectWizard::emptyValues(),
            'pi' => $project ? self::piOf($project) : self::currentFaculty($user),
            'options' => [
                'sdgs' => config('sdgs.goals'),
                'manpowerCategories' => ProjectBudget::MANPOWER_CATEGORIES,
                'budgetHeads' => ProjectBudget::heads(),
                'duration' => ['years' => ProjectDuration::yearOptions(), 'maxMonths' => ProjectDuration::MAX_MONTHS],
                'milestoneStatuses' => ProjectWizard::MILESTONE_STATUSES,
            ],
            'submit' => [
                'label' => $id ? 'Save changes' : 'Submit',
                'path' => $id ? "/projects/wizard/{$id}" : '/projects/wizard',
                'review' => '/projects/wizard/review',
            ],
        ]);
    }

    /** The PI a new project is filed under: the signed-in faculty, if they are one. */
    private static function currentFaculty(User $user): ?array
    {
        $faculty = Faculty::with(['user', 'department'])->where('user_id', $user->id)->first();
        return $faculty ? [
            'code' => $faculty->faculty_code,
            'name' => $faculty->user->name(),
            'department' => $faculty->department->name ?? 'N/A',
            'designation' => $faculty->designation,
        ] : null;
    }

    private static function piOf(array $project): ?array
    {
        $pi = $project['pi'] ?? null;
        return $pi ? [
            'code' => $pi['faculty_code'],
            'name' => trim(($pi['user']['first_name'] ?? '') . ' ' . ($pi['user']['last_name'] ?? '')),
            'department' => $pi['department']['name'] ?? '',
            'designation' => $pi['designation'] ?? '',
        ] : null;
    }
}
