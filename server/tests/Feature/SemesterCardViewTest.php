<?php

namespace Tests\Feature;

use App\Http\Controllers\SemesterController;
use App\Models\Role;
use App\Models\User;
use App\Pages\SemesterCardPage;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Tests\TestCase;

/**
 * The semester card's state for a role and a day: which of none, completed,
 * stats or nothing it shows, and the actions each role has on it.
 */
class SemesterCardViewTest extends TestCase
{
    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function viewAs(string $role, ?array $semester, array $params = [], string $today = '2026-09-25 12:00:00'): array
    {
        Carbon::setTestNow(Carbon::parse($today, 'UTC'));
        $answer = $semester ? response()->json(['data' => $semester]) : response()->json(['message' => 'No semesters found.'], 404);
        $this->app->instance(SemesterController::class, new class($answer) extends SemesterController {
            public function __construct(private $answer)
            {
            }

            public function getRecent(Request $request, $semester_id = null)
            {
                return $this->answer;
            }
        });
        $user = new User();
        $user->setRelation('current_role', new Role(['role' => $role]));

        return (new SemesterCardPage())->view($user, $params);
    }

    private function semester(string $start = '2026-07-01T00:00:00.000000Z', string $end = '2026-12-15T00:00:00.000000Z'): array
    {
        return ['semester_name' => '2627ODD', 'start_date' => $start, 'end_date' => $end, 'leave' => 1, 'scheduled' => 2, 'unscheduled' => 3, 'notification' => false];
    }

    public function test_no_semester_asks_only_the_office_to_create_one(): void
    {
        $this->assertSame('none', $this->viewAs('dordc', null)['state']);
        $this->assertSame('hidden', $this->viewAs('hod', null)['state']);
    }

    public function test_an_active_semester_offers_each_role_its_actions(): void
    {
        $labels = fn (array $view) => array_map(fn ($action) => $action['label'] ?? 'filters', $view['actions']);

        $admin = $this->viewAs('admin', $this->semester());
        $this->assertSame(['Active', ['View current semester details', 'filters', 'Edit evaluation semester']], [$admin['badge']['text'], $labels($admin)]);
        $this->assertCount(5, $admin['facts']);

        $faculty = $this->viewAs('faculty', $this->semester());
        $this->assertSame(['View current semester details', 'filters', 'Schedule progress monitoring'], $labels($faculty));
        $this->assertCount(2, $faculty['facts']);

        // A semester's own list does not link to itself.
        $this->assertSame(['filters', 'Edit evaluation semester'], $labels($this->viewAs('admin', $this->semester(), ['semester' => '2627ODD'])));
    }

    public function test_a_semester_ends_at_the_start_of_its_end_date(): void
    {
        $ended = $this->semester(end: '2026-09-25T00:00:00.000000Z');

        $this->assertSame('completed', $this->viewAs('admin', $ended)['state']);
        $this->assertSame('hidden', $this->viewAs('faculty', $ended)['state']);
        // A past semester's own list still shows its figures, with nothing to schedule.
        $past = $this->viewAs('faculty', $ended, ['semester' => '2627ODD']);
        $this->assertSame(['stats', null, [['toggles_filters' => true]]], [$past['state'], $past['badge'], $past['actions']]);
    }

    public function test_an_upcoming_semester_is_badged_and_open_to_scheduling(): void
    {
        $view = $this->viewAs('phd_coordinator', $this->semester(start: '2026-10-01T00:00:00.000000Z'));

        $this->assertSame('Upcoming', $view['badge']['text']);
        $this->assertSame('Schedule progress monitoring', $view['actions'][1]['label']);
    }
}
