<?php

namespace Tests\Unit;

use App\Support\Navigation;
use Tests\TestCase;

/**
 * What each role may reach and the menus drawn for it (config/navigation.php).
 * The fixture was taken from the web's own lists (access.js, the sidebar, the
 * breadcrumb and the home tiles) for all thirteen roles, modules on and off,
 * before those lists were removed, so the web and the app draw exactly what
 * the web drew. A deliberate change to who reaches what regenerates it:
 *   UPDATE_NAVIGATION=1 php artisan test --filter=NavigationTest
 */
class NavigationTest extends TestCase
{
    public function test_every_role_reaches_and_sees_what_it_did(): void
    {
        $path = base_path('tests/fixtures/navigation.json');
        $cases = json_decode(file_get_contents($path), true);
        $this->assertCount(26, $cases);

        foreach ($cases as &$case) {
            $now = Navigation::for($case['role'], $case['capabilities'], $case['features']);
            if (getenv('UPDATE_NAVIGATION')) {
                $case['me'] = $now;
                continue;
            }
            $this->assertSame($case['me'], $now, $case['role'] . ' ' . json_encode($case['features']));
        }

        if (getenv('UPDATE_NAVIGATION')) {
            file_put_contents($path, json_encode($cases, JSON_PRETTY_PRINT) . "\n");
            $this->markTestIncomplete('navigation.json rewritten; review the diff.');
        }
    }

    public function test_a_module_switched_off_leaves_the_menu_but_keeps_its_page_name(): void
    {
        $caps = ['can_manage_projects' => true];
        $on = Navigation::for('admin', $caps, ['project_management' => true, 'job_openings' => true]);
        $off = Navigation::for('admin', $caps, ['project_management' => false, 'job_openings' => true]);

        $this->assertContains('/projects', array_column($on['nav'], 'path'));
        $this->assertNotContains('/projects', array_column($off['nav'], 'path'));
        $this->assertSame('Projects', $off['labels']['/projects']);
    }

    public function test_urf_shows_only_to_those_holding_a_urf_capability(): void
    {
        $features = ['project_management' => true, 'job_openings' => true];
        $mentor = Navigation::for('faculty', ['can_read_urf_mentees' => true], $features);
        $other = Navigation::for('faculty', ['can_read_urf_mentees' => false], $features);

        $this->assertContains('/urf', array_column($mentor['nav'], 'path'));
        $this->assertNotContains('/urf', array_column($other['nav'], 'path'));
        // Faculty may still open the area; the menu only hides it.
        $this->assertTrue($other['areas']['urf']);
    }

    /**
     * The DORDC approves the last step of every URF form and the ADORDC the one
     * before it, so the page is theirs whether or not they mentor a project.
     */
    public function test_the_two_urf_reviewers_see_the_page_without_mentoring_anything(): void
    {
        $features = ['project_management' => true, 'job_openings' => true];

        foreach (['dordc', 'adordc'] as $role) {
            $menu = Navigation::for($role, ['can_read_urf_mentees' => true], $features);
            $this->assertContains('/urf', array_column($menu['nav'], 'path'), $role);
        }

        $this->assertContains('dordc', config('navigation.urf_reviewers'));
        $this->assertContains('adordc', config('navigation.urf_reviewers'));
    }

    /**
     * The DORDC is the office: every page the admin role reaches is theirs too,
     * so they never switch role to do their own work. What they do not hold is
     * can_approve_any_step, which is a capability rather than a page.
     */
    public function test_the_dordc_reaches_every_page_the_office_does(): void
    {
        $features = ['project_management' => true, 'job_openings' => true];
        $capabilities = ['can_read_urf_mentees' => true, 'can_manage_clerks' => true, 'can_mark_attendance' => true];
        $office = Navigation::for('admin', $capabilities, $features);
        $dordc = Navigation::for('dordc', $capabilities, $features);

        foreach (array_keys(array_filter($office['areas'])) as $area) {
            $this->assertTrue($dordc['areas'][$area], $area . ' belongs to the office and so to the DORDC');
        }

        $paths = array_column($dordc['nav'], 'path');
        foreach (['/clerks', '/attendance', '/users', '/configuration', '/logs', '/outside-experts'] as $path) {
            $this->assertContains($path, $paths, $path);
        }
    }
}
