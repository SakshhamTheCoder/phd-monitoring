<?php

namespace App\Pages;

use App\Http\Controllers\AdminFormController;
use App\Models\User;
use Symfony\Component\HttpKernel\Exception\HttpException;

/** Every page described by the server, by the name GET /views/{page} takes. */
final class Pages
{
    private const PAGES = [
        'areas-of-specialization' => AreasPage::class,
        'clerks' => ClerksPage::class,
        'configuration' => ConfigurationPage::class,
        'courses' => CoursesPage::class,
        'departments' => DepartmentsPage::class,
        'faculty' => FacultyPage::class,
        'form-list' => FormListPage::class,
        'forms-menu' => FormsMenuPage::class,
        'my-attendance' => MyAttendancePage::class,
        'openings' => OpeningsPage::class,
        'outside-experts' => OutsideExpertsPage::class,
        'presentation-list' => PresentationListPage::class,
        'presentations' => PresentationsPage::class,
        'project' => ProjectPage::class,
        'project-recruitment' => ProjectRecruitmentPage::class,
        'project-wizard' => ProjectWizardPage::class,
        'projects' => ProjectsPage::class,
        'research-profile' => ResearchProfilePage::class,
        'semester-card' => SemesterCardPage::class,
        'student-profile' => StudentProfilePage::class,
        'student-progress' => StudentProgressPage::class,
        'students' => StudentsPage::class,
        'supervisor-approvals' => SupervisorApprovalsPage::class,
        'urf' => UrfPage::class,
        'ug-profile' => UgProfilePage::class,
        'urf-form' => UrfStudentFormPage::class,
        'urf-forms' => UrfStudentFormsPage::class,
        'urf-record' => UrfRecordPage::class,
        'users' => UsersPage::class,
    ];

    // Lists opened without route parameters, answered together after sign-in
    // so each opens without first waiting for its own description.
    private const PREFETCHED = [
        'areas-of-specialization', 'clerks', 'configuration', 'courses', 'departments', 'faculty', 'forms-menu',
        'openings', 'outside-experts', 'presentations', 'projects', 'students', 'supervisor-approvals', 'urf', 'users',
    ];

    /**
     * Every list this reader may open that needs no route parameters, each
     * keyed as the client asks for it: the page name, then its query.
     */
    public static function prefetched(User $user): array
    {
        $wanted = array_map(fn ($name) => [$name, []], [...self::PREFETCHED, ...array_keys(UrfFormListPage::FORMS)]);
        foreach (array_keys(app(AdminFormController::class)->formMetadata) as $type) {
            $wanted[] = ['form-list', ['form_type' => $type]];
        }

        $views = [];
        foreach ($wanted as [$name, $params]) {
            $page = self::find($name);
            if (!$page || !$page->allows($user)) {
                continue;
            }
            try {
                $views[$name . '?' . http_build_query($params)] = $page->view($user, $params);
            } catch (HttpException) {
                // Refused for this reader after all; the page asks for itself if opened.
            }
        }
        return $views;
    }

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
