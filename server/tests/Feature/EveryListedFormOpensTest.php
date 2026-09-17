<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * Every form a list shows its reader must open for that reader.
 *
 * Lists scoped by department or supervision while the loaders also asked
 * whether the reader's step had been reached, so rows opened onto "not yet
 * assigned to you" or "not authorized". Driven against whatever the database
 * holds, a few accounts per role; run it against a copy of real data too:
 *   DB_DATABASE=phd_monitoring_e2e vendor/bin/phpunit tests/Feature/EveryListedFormOpensTest.php
 */
class EveryListedFormOpensTest extends TestCase
{
    use DatabaseTransactions;

    private const FORM_TYPES = [
        'irb-constitution', 'irb-submission', 'irb-extension', 'synopsis-submission', 'revise-title',
        'thesis-submission', 'thesis-extension', 'supervisor-change', 'supervisor-allocation',
        'status-change', 'semester-off', 'list-of-examiners', 'student-leave',
    ];

    private const ACCOUNTS_PER_ROLE = 3;

    public function test_a_listed_form_never_refuses_the_reader_it_was_listed_for(): void
    {
        $refused = [];
        $opened = 0;

        foreach (Role::query()->pluck('id', 'role') as $role => $roleId) {
            $users = User::where('current_role_id', $roleId)->limit(self::ACCOUNTS_PER_ROLE)->get();

            foreach ($users as $user) {
                foreach (self::FORM_TYPES as $type) {
                    $this->app['auth']->forgetGuards();
                    $list = $this->actingAs($user)->getJson("/api/forms/{$type}?page=1&rows=50");
                    if ($list->status() !== 200) {
                        continue;
                    }

                    foreach ($list->json('data') ?? [] as $row) {
                        $this->app['auth']->forgetGuards();
                        $status = $this->actingAs($user)->getJson("/api/forms/{$type}/{$row['id']}")->status();
                        $status === 200
                            ? $opened++
                            : $refused[] = "{$role} {$user->email} {$type} #{$row['id']} stage {$row['stage']}: {$status}";
                    }
                }
            }
        }

        $this->assertSame([], $refused, "Listed but refused ({$opened} opened):\n" . implode("\n", $refused));
    }

    /** Progress monitoring lists per semester, and every tab reads the same rows. */
    public function test_an_evaluation_listed_for_a_semester_opens(): void
    {
        $refused = [];
        $opened = 0;
        $semesters = \App\Models\Semester::orderByDesc('start_date')->limit(4)->pluck('semester_name');
        $everything = urlencode('{}');

        foreach (Role::query()->pluck('id', 'role') as $role => $roleId) {
            foreach (User::where('current_role_id', $roleId)->limit(self::ACCOUNTS_PER_ROLE)->get() as $user) {
                foreach ($semesters as $semester) {
                    $this->app['auth']->forgetGuards();
                    $list = $this->actingAs($user)->getJson("/api/presentation/semester/{$semester}?page=1&rows=50&filters={$everything}");
                    if ($list->status() !== 200) {
                        continue;
                    }
                    foreach ($list->json('data') ?? [] as $row) {
                        $this->app['auth']->forgetGuards();
                        $status = $this->actingAs($user)->getJson("/api/presentation/semester/{$semester}/{$row['id']}")->status();
                        $status === 200
                            ? $opened++
                            : $refused[] = "{$role} {$user->email} {$semester} #{$row['id']} stage {$row['stage']}: {$status}";
                    }
                }
            }
        }

        $this->assertSame([], $refused, "Listed but refused ({$opened} opened):\n" . implode("\n", $refused));
    }

    /**
     * The same promise from a scholar's profile, which lists and opens under
     * /students/{roll}.
     */
    public function test_a_form_listed_on_a_scholars_profile_opens_from_there(): void
    {
        $refused = [];
        $opened = 0;

        foreach (Role::query()->pluck('id', 'role') as $role => $roleId) {
            foreach (User::where('current_role_id', $roleId)->limit(self::ACCOUNTS_PER_ROLE)->get() as $user) {
                $this->app['auth']->forgetGuards();
                $scholars = $this->actingAs($user)->getJson('/api/students?page=1&rows=5');
                if ($scholars->status() !== 200) {
                    continue;
                }

                foreach (collect($scholars->json('data'))->pluck('roll_no')->filter() as $roll) {
                    foreach (self::FORM_TYPES as $type) {
                        $this->app['auth']->forgetGuards();
                        $list = $this->actingAs($user)->getJson("/api/students/{$roll}/forms/{$type}?page=1&rows=50");
                        if ($list->status() !== 200) {
                            continue;
                        }
                        foreach ($list->json('data') ?? [] as $row) {
                            $this->app['auth']->forgetGuards();
                            $status = $this->actingAs($user)->getJson("/api/students/{$roll}/forms/{$type}/{$row['id']}")->status();
                            $status === 200
                                ? $opened++
                                : $refused[] = "{$role} {$user->email} scholar {$roll} {$type} #{$row['id']} stage {$row['stage']}: {$status}";
                        }
                    }
                }
            }
        }

        $this->assertSame([], $refused, "Listed but refused ({$opened} opened):\n" . implode("\n", $refused));
    }
}
