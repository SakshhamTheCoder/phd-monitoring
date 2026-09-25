<?php

namespace App\Pages;

use App\Http\Controllers\PositionApplicationController;
use App\Models\FeatureFlag;
use App\Models\User;
use App\Support\Badge;
use App\Support\Navigation;

/**
 * The openings board a scholar applies from. The page (its words, tabs and
 * what an application needs) is described once and kept; the positions, the
 * scholar's applications and what the apply form starts from come from GET
 * /openings/board, each value phrased. Applying goes to the apply endpoint.
 */
final class OpeningsPage extends PageDefinition
{
    public function allows(User $user): bool
    {
        return FeatureFlag::enabled('job_openings') && Navigation::allows($user, 'openings');
    }

    public function view(User $user, array $params = []): array
    {
        return self::page('Openings', 'Browse research positions and internships, and apply directly through the portal.', [
            'data' => '/openings/board',
            // {n} is how many each tab holds.
            'tabs' => [['value' => 'All', 'label' => 'All ({n})'], ['value' => 'Applied', 'label' => 'Applied ({n})']],
            'states' => [
                'loading' => 'Loading openings',
                'failed' => 'Could not load the openings. Check your connection and try again.',
                'All' => 'No open positions right now. Check back soon.',
                'Applied' => "You haven't applied to any openings yet.",
            ],
            // What an application needs before it is sent, in the order it is checked.
            'apply_checks' => [
                ['keys' => ['name', 'email', 'phone'], 'message' => 'Please fill in your contact details.'],
                ['keys' => ['degree', 'institute', 'cgpa'], 'message' => 'Please fill in your academic details.'],
                ['keys' => ['resumeFile'], 'message' => 'Please attach your resume.'],
            ],
        ]);
    }

    /** The positions, the scholar's applications and the apply form's start. */
    public static function board(): array
    {
        $controller = app(PositionApplicationController::class);
        $read = fn ($response) => $response->getStatusCode() === 200 ? json_decode(json_encode($response->getData()), true) : null;
        $positions = $read($controller->openings());
        $applications = $read($controller->myApplications());
        abort_if($positions === null || $applications === null, 503);
        $profile = $read($controller->applicantProfile()) ?? [];

        // Today where the portal runs, so a position stays open on its last day.
        $today = now()->toDateString();
        $applied = array_map(fn ($a) => (string) $a['position_id'], $applications);
        $shown = array_map(fn ($p) => self::position($p, in_array((string) $p['id'], $applied, true), $today), $positions);

        return [
            // Every position sent; the board lists the open ones, and an
            // application can still open its closed one.
            'positions' => $shown,
            'applications' => array_map(fn ($a) => [
                'id' => $a['id'],
                'type' => $a['position']['type'] ?? null,
                'title' => $a['position']['title'] ?? null,
                'project' => $a['position']['project']['title'] ?? null,
                'badge' => Badge::of($a['status']),
                'applied_date' => $a['applied_date'],
                'resume' => ($a['resume_path'] ?? null) ? basename($a['resume_path']) : null,
                'position_id' => collect($shown)->contains('id', $a['position_id']) ? $a['position_id'] : null,
            ], $applications),
            // The apply form, from the scholar's own profile; every field stays editable.
            'apply_values' => array_map(fn ($value) => $value ?: '', array_merge(
                array_fill_keys(['name', 'email', 'phone', 'degree', 'institute', 'cgpa', 'research'], ''),
                array_intersect_key($profile, array_flip(['name', 'email', 'phone', 'degree', 'institute', 'cgpa', 'research'])),
            )),
        ];
    }

    private static function position(array $p, bool $applied, string $today): array
    {
        $skills = is_array($p['skills'] ?? null) ? $p['skills'] : explode(',', (string) ($p['skills'] ?? ''));

        return [
            'id' => $p['id'],
            'type' => $p['type'],
            'title' => $p['title'],
            'project' => $p['project']['title'] ?? ($p['project_title'] ?? null),
            'deadline' => $p['deadline'],
            'description' => $p['description'],
            'stipend' => $p['stipend'],
            'eligibility' => $p['eligibility'],
            'cgpa' => $p['min_cgpa'] ?? null,
            'openings' => $p['openings'],
            'skills' => array_values(array_filter(array_map(fn ($s) => is_string($s) ? trim($s) : $s, $skills))),
            'applied' => $applied,
            'closed' => ($p['deadline'] ?? null) && substr((string) $p['deadline'], 0, 10) < $today,
        ];
    }
}
