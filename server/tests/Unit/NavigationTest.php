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
}
