<?php

namespace Tests\Feature;

use App\Models\Presentation;
use App\Models\Project;
use App\Models\Role;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Routing\Route;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Every GET endpoint, called as every role, with real ids.
 *
 * Each feature test drives the paths it was written for, which is how an admin
 * could open Progress Monitoring onto a 500 while the suite stayed green. This
 * asks one question of the whole API instead: does anything crash for anyone.
 *
 * A 500 fails the test. Every status is also written to
 * storage/app/role-sweep.json, so a refusal that should not be there can be
 * read against the sidebar's ACCESS map by eye.
 *
 * Accounts come from TestFixturesSeeder ({role}@fixture.test). Run against a
 * copy of real data for the widest coverage:
 *   DB_DATABASE=phd_monitoring_e2e vendor/bin/phpunit tests/Feature/RoleSweepTest.php
 */
class RoleSweepTest extends TestCase
{
    use DatabaseTransactions;

    /** Signed links, OAuth hand-offs and mail senders, none of which a signed-in page calls. */
    private const SKIPPED = [
        'api/google/redirect',
        'api/google/callback',
        'api/reset-password/{token}',
        'api/urf/verify-email/{id}',
    ];

    /** Form slug in a URL => the table its rows live in. */
    private const FORM_TABLES = [
        'irb-constitution' => 'constitute_of_irb',
        'irb-submission' => 'irb_sub_forms',
        'irb-extension' => 'research_extentions_form',
        'synopsis-submission' => 'synopsis_submissions',
        'revise-title' => 'revise_title_forms',
        'thesis-submission' => 'thesis_submissions',
        'thesis-extension' => 'thesis_extentions_form',
        'supervisor-change' => 'supervisor_change_forms',
        'supervisor-allocation' => 'supervisor_allocation_form',
        'status-change' => 'student_status_change_forms',
        'semester-off' => 'student_semester_off_forms',
        'list-of-examiners' => 'list_of_examiners_forms',
        'student-leave' => 'student_leave_forms',
        'presentation' => 'presentations',
    ];

    public function test_no_get_endpoint_crashes_for_any_role(): void
    {
        Http::fake();

        $accounts = $this->accounts();
        if (!$accounts) {
            $this->markTestSkipped('No {role}@fixture.test accounts. Seed TestFixturesSeeder.');
        }

        $scholar = $this->busiestScholar();
        $results = [];
        $crashes = [];
        $unfilled = [];

        foreach ($this->getRoutes() as $route) {
            $uri = $this->fill($route->uri(), $scholar);
            if ($uri === null) {
                $unfilled[] = $route->uri();
                continue;
            }

            foreach ($accounts as $role => $user) {
                $this->app['auth']->forgetGuards();
                // A file download is a BinaryFileResponse, which has no status().
                $response = $this->actingAs($user)->getJson('/' . $uri)->baseResponse;
                $status = $response->getStatusCode();
                $results[$route->uri()][$role] = $status;
                if ($status >= 500) {
                    $message = json_decode((string) $response->getContent(), true)['message'] ?? '';
                    $crashes[] = "{$role} GET /{$uri} {$message}";
                }
            }
        }

        $this->writeReport($results, $unfilled, $scholar);

        $this->assertSame([], $crashes, "Endpoints that crashed:\n" . implode("\n", $crashes));
    }

    /**
     * Every write endpoint, called as every role with an empty body.
     *
     * Not asserted: an empty body is refused for many reasons. Written to
     * storage/app/role-sweep-writes.json so an endpoint that accepts a write
     * from a role that should never reach it stands out.
     */
    public function test_record_how_every_write_endpoint_answers_each_role(): void
    {
        Http::fake();
        \Illuminate\Support\Facades\Queue::fake();
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::fake('public');

        $accounts = $this->accounts();
        if (!$accounts) {
            $this->markTestSkipped('No {role}@fixture.test accounts. Seed TestFixturesSeeder.');
        }

        $scholar = $this->busiestScholar();
        $results = [];

        foreach (iterator_to_array($this->app['router']->getRoutes()) as $route) {
            $method = collect($route->methods())->first(fn ($m) => in_array($m, ['POST', 'PUT', 'PATCH', 'DELETE'], true));
            if (!$method || !str_starts_with($route->uri(), 'api/')) {
                continue;
            }
            // Placeholders that do not resolve get an id no row has, so the
            // route still matches and its guard still runs.
            $uri = $this->fill($route->uri(), $scholar) ?? preg_replace('/\{\w+\??\}/', '999999999', $route->uri());

            foreach ($accounts as $role => $user) {
                $this->app['auth']->forgetGuards();
                DB::beginTransaction();
                try {
                    $status = $this->actingAs($user)->json($method, '/' . $uri, [])->baseResponse->getStatusCode();
                } catch (\Throwable $e) {
                    $status = 'threw ' . class_basename($e);
                }
                DB::rollBack();
                $results["{$method} {$route->uri()}"][$role] = $status;
            }
        }

        file_put_contents(storage_path('app/role-sweep-writes.json'), json_encode($results, JSON_PRETTY_PRINT));
        $this->assertNotEmpty($results);
    }

    /** @return array<string, User> */
    private function accounts(): array
    {
        $accounts = [];
        foreach (Role::query()->pluck('role') as $role) {
            $user = User::where('email', "{$role}@fixture.test")->first();
            if ($user) {
                $accounts[$role] = $user;
            }
        }

        // Most real institute officer accounts carry no faculty row, where every
        // fixture reviewer does. Both shapes have to hold up.
        foreach (['dordc', 'dra', 'director'] as $role) {
            $bare = User::whereHas('current_role', fn ($q) => $q->where('role', $role))
                ->whereDoesntHave('faculty')
                ->first();
            if ($bare) {
                $accounts["{$role} without faculty row"] = $bare;
            }
        }

        return $accounts;
    }

    /** @return Route[] */
    private function getRoutes(): array
    {
        return array_values(array_filter(
            iterator_to_array($this->app['router']->getRoutes()),
            fn (Route $route) => in_array('GET', $route->methods(), true)
                && str_starts_with($route->uri(), 'api/')
                && !in_array($route->uri(), self::SKIPPED, true)
        ));
    }

    /** The scholar with the most form rows, so their pages have something on them. */
    private function busiestScholar(): ?int
    {
        $counts = [];
        foreach (array_unique(self::FORM_TABLES) as $table) {
            foreach (DB::table($table)->select('student_id', DB::raw('count(*) as total'))->groupBy('student_id')->get() as $row) {
                $counts[$row->student_id] = ($counts[$row->student_id] ?? 0) + $row->total;
            }
        }
        arsort($counts);
        return array_key_first($counts) ?? Student::query()->value('roll_no');
    }

    /** Real values for each placeholder, or null when this database has none. */
    private function fill(string $uri, ?int $scholar): ?string
    {
        $formSlug = null;
        foreach (array_keys(self::FORM_TABLES) as $slug) {
            if (str_contains($uri, "/{$slug}")) {
                $formSlug = $slug;
            }
        }

        $formRow = function () use ($formSlug, $scholar) {
            $table = self::FORM_TABLES[$formSlug];
            return DB::table($table)->where('student_id', $scholar)->orderByDesc('id')->first()
                ?? DB::table($table)->orderByDesc('id')->first();
        };

        $values = [
            'id' => fn () => match (true) {
                str_starts_with($uri, 'api/students/') => $scholar,
                str_starts_with($uri, 'api/projects/') => Project::query()->value('id'),
                str_starts_with($uri, 'api/public/openings/') => DB::table('project_positions')->value('id'),
                str_starts_with($uri, 'api/users/') => User::where('email', 'student@fixture.test')->value('id'),
                str_starts_with($uri, 'api/urf/') => DB::table('urf_applications')->value('id'),
                default => null,
            },
            'student_id' => fn () => $scholar,
            'studentId' => fn () => $scholar,
            'roll_no' => fn () => $scholar,
            'form_id' => fn () => $formRow()?->id,
            'semester_id' => fn () => $formSlug === 'presentation'
                ? ($formRow()?->period_of_report ?? DB::table('semesters')->orderByDesc('start_date')->value('semester_name'))
                : null,
            'facultyCode' => fn () => DB::table('faculty')->value('faculty_code'),
            'group' => fn () => 'leave',
            'token' => fn () => str_starts_with($uri, 'api/external-review/')
                ? DB::table('approvals')->value('key')
                : DB::table('position_applications')->value('token'),
            'key' => fn () => DB::table('approvals')->value('key'),
        ];

        $unfillable = false;
        $filled = preg_replace_callback('/\{(\w+)\??\}/', function ($match) use ($values, &$unfillable) {
            $value = isset($values[$match[1]]) ? $values[$match[1]]() : null;
            if ($value === null) {
                $unfillable = true;
                return $match[0];
            }
            return rawurlencode((string) $value);
        }, $uri);

        return $unfillable ? null : $filled;
    }

    private function writeReport(array $results, array $unfilled, ?int $scholar): void
    {
        $path = storage_path('app/role-sweep.json');
        file_put_contents($path, json_encode([
            'database' => config('database.connections.mysql.database'),
            'scholar' => $scholar,
            'unfilled' => $unfilled,
            'results' => $results,
        ], JSON_PRETTY_PRINT));
    }
}
