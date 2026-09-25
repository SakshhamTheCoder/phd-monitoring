<?php

namespace App\Pages;

use App\Http\Controllers\FacultyProfileController;
use App\Models\AreaOfSpecialization;
use App\Models\User;

/**
 * A faculty member's research profile: who they are and the identifiers the
 * publication sync runs on, the scholars they supervise and sit on committees
 * for, then the publications workbench, which stays a block of its own. The
 * signed-in faculty's own on their home page, anyone's at
 * /faculty/{facultyCode}/profile.
 */
final class ResearchProfilePage extends PageDefinition
{
    // The publications panel, which the Research profile button scrolls to.
    private const RESEARCH_ID = 'research-publications';

    public function allows(User $user): bool
    {
        // The profile endpoint decides whom it answers.
        return true;
    }

    public function view(User $user, array $params = []): array
    {
        $answer = app(FacultyProfileController::class)->show($params['facultyCode'] ?? '');
        abort_if($answer->getStatusCode() !== 200, $answer->getStatusCode());
        $data = json_decode(json_encode($answer->getData()), true);
        $profile = $data['profile'];
        $canEdit = !empty($data['can_edit']);
        $seesSupervision = !empty($data['can_view_supervision']);
        $expertise = is_array($profile['expertise']) ? implode(', ', $profile['expertise']) : ($profile['expertise'] ?: '');

        return self::page((string) $profile['name'], "{$profile['designation']}, {$profile['department']}", [
            'page_class' => 'reveal',
            'actions' => array_values(array_filter([
                $canEdit ? ['edit' => true] : null,
                // Research sits below the supervision tables, which most visits
                // are about; this reaches it without scrolling past them.
                ['label' => 'Research profile', 'variant' => 'secondary', 'scroll_to' => self::RESEARCH_ID],
            ])),
            'edit' => $canEdit ? [
                'values' => [
                    'phone' => ($profile['phone'] ?? null) ?: '',
                    'expertise' => $expertise,
                    'area_of_specialization_id' => $profile['area_of_specialization_id'] ?: '',
                    'supervised_outside' => $profile['supervised_outside'] ?? 0,
                    'orcid_id' => $profile['orcid_id'] ?: '',
                    'scopus_id' => $profile['scopus_id'] ?: '',
                    'google_scholar_id' => $profile['google_scholar_id'] ?: '',
                    'joined_on' => $profile['joined'] ?: '',
                    'citations' => $profile['citations'] ?? '',
                    'h_index' => $profile['h_index'] ?? '',
                ],
                'request' => ['method' => 'POST', 'path' => "/faculty/{$profile['faculty_code']}/profile", 'done' => 'Profile updated.', 'failure' => 'fetch', 'loader' => false],
                'save_state' => 'none',
            ] : null,
            'sections' => array_values(array_filter([
                // One panel, so one Edit shows everything one Save writes.
                ['kind' => 'details', 'parts' => [
                    ['rows' => self::identity($data, $profile, $expertise)],
                    ['title' => 'Academic identifiers', 'rows' => self::identifiers($profile)],
                ]],
                $seesSupervision ? self::students('Supervising students', $data['supervised_students'] ?? [], ['name' => 'Name', 'roll_no' => 'Roll no', 'email' => 'Email', 'date_of_admission' => 'Date of admission'], 'No students currently being supervised.') : null,
                $seesSupervision ? self::students('Doctoral committee membership', $data['doctoral_committee_students'] ?? [], ['name' => 'Name', 'roll_no' => 'Roll no', 'email' => 'Email', 'department' => 'Department', 'date_of_admission' => 'Date of admission'], 'Not a member of any doctoral committee.') : null,
                ['kind' => 'block', 'block' => 'research-publications', 'props' => [
                    'anchor' => self::RESEARCH_ID,
                    'faculty_code' => $profile['faculty_code'],
                    'profile' => array_intersect_key($profile, array_flip(['name', 'last_sync', 'last_sync_source', 'total_publications', 'synced', 'self_reported'])),
                    'publications' => $data['publications'],
                    'student_publications' => $data['student_publications'] ?? (object) [],
                    'can_edit' => $canEdit,
                    'can_sync' => !empty($data['can_sync']),
                    'can_view_supervision' => $seesSupervision,
                ]],
            ])),
        ]);
    }

    /**
     * Who they are. Phone is absent, not blank, for a reader who may not see
     * it, so the row goes with it.
     */
    private static function identity(array $data, array $profile, string $expertise): array
    {
        $counts = $data['counts'] ?? [];
        $areas = $profile['department_id']
            ? AreaOfSpecialization::where('department_id', $profile['department_id'])->orderBy('name')->get(['id', 'name'])
                ->map(fn ($area) => ['title' => $area->name, 'value' => $area->id])->all()
            : [];

        return array_values(array_filter([
            ['label' => 'Email', 'value' => $profile['email']],
            array_key_exists('phone', $profile) ? ['label' => 'Phone', 'value' => $profile['phone'], 'field' => 'phone'] : null,
            ['label' => 'Faculty Code', 'value' => $profile['faculty_code']],
            ['label' => 'Supervised (Within TIET)', 'value' => $profile['supervised_campus'] ?? 0],
            [
                'label' => 'Supervised (Outside TIET)',
                'value' => $profile['supervised_outside'] ?? 0,
                'field' => 'supervised_outside',
                'type' => 'number',
                'hint' => 'Scholars you guide at another institute. They count against your supervision limit.',
            ],
            // A reader who may not see who the scholars are still sees how many.
            empty($data['can_view_supervision']) ? ['label' => 'Supervising', 'value' => $counts['supervised_count'] ?? 0] : null,
            empty($data['can_view_supervision']) ? ['label' => 'Doctoral Committees', 'value' => $counts['doctoral_committee_count'] ?? 0] : null,
            $profile['website'] ? ['label' => 'Website', 'value' => $profile['website']] : null,
            ['label' => 'Broad Area of Expertise', 'value' => $profile['broad_area'], 'field' => 'area_of_specialization_id', 'options' => $areas, 'hint' => "One of your department's research areas."],
            ['label' => 'Specific Areas', 'value' => $expertise, 'field' => 'expertise', 'hint' => 'Separate each area with a comma.', 'span' => 'all'],
        ]));
    }

    /** What the sync runs on, kept beside the Sync button that uses it. */
    private static function identifiers(array $profile): array
    {
        $scholar = $profile['google_scholar_id'];

        return [
            ['label' => 'ORCID iD', 'value' => $profile['orcid_id'], 'field' => 'orcid_id'],
            ['label' => 'Scopus ID', 'value' => $profile['scopus_id'], 'field' => 'scopus_id'],
            array_filter(['label' => 'Google Scholar ID', 'field' => 'google_scholar_id', 'link' => $scholar ? ['href' => "https://scholar.google.com/citations?user={$scholar}", 'text' => $scholar] : null]),
            ['label' => 'Citations', 'value' => $profile['citations'], 'field' => 'citations', 'type' => 'number'],
            ['label' => 'h-index', 'value' => $profile['h_index'], 'field' => 'h_index', 'type' => 'number'],
            ['label' => 'Joined', 'date' => $profile['joined'], 'field' => 'joined_on', 'type' => 'date'],
        ];
    }

    /** A scholar's name opens their profile. */
    private static function students(string $title, array $rows, array $columns, string $empty): array
    {
        return [
            'kind' => 'table',
            'title' => $title,
            'columns' => array_map(fn ($key, $heading) => array_filter(['key' => $key, 'title' => $heading, 'cell' => $key === 'name' ? 'student-link' : null]), array_keys($columns), $columns),
            'rows' => $rows,
            'pointer_rows' => true,
            'empty_notice' => $empty,
        ];
    }
}
