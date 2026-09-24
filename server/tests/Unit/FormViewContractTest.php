<?php

namespace Tests\Unit;

use App\Forms\FormDefinition;
use App\Forms\ReviseTitleDefinition;
use Tests\TestCase;

/**
 * The views in tests/fixtures/form-views are what the web and the app draw from
 * in their own tests. This keeps them equal to what the server actually sends,
 * so a change here that a client has not been shown fails on this side.
 *
 * After a deliberate change, regenerate them with
 *   UPDATE_FORM_VIEWS=1 php artisan test --filter=FormViewContractTest
 * and review the diff before committing it.
 */
class FormViewContractTest extends TestCase
{
    private const DEFINITIONS = [
        'revise-title' => ReviseTitleDefinition::class,
    ];

    public static function forms(): array
    {
        return array_map(fn ($class) => [$class], self::DEFINITIONS);
    }

    /** @dataProvider forms */
    public function test_the_fixture_is_what_the_server_sends(string $class): void
    {
        $type = array_search($class, self::DEFINITIONS, true);
        $path = base_path("tests/fixtures/form-views/$type.json");
        $cases = json_decode(file_get_contents($path), true);
        $this->assertNotEmpty($cases);

        foreach ($cases as &$case) {
            $data = $case['formData'];
            unset($data['view']);
            $view = (new $class)->view($data);
            if (getenv('UPDATE_FORM_VIEWS')) {
                $case['formData']['view'] = $view;
                continue;
            }
            $this->assertSame($case['formData']['view'], $view, "$type: {$case['name']}");
        }

        if (getenv('UPDATE_FORM_VIEWS')) {
            file_put_contents($path, json_encode($cases, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . "\n");
            $this->markTestIncomplete("$type.json rewritten; review the diff.");
        }
    }

    /** @dataProvider forms */
    public function test_every_view_carries_the_scholars_own_panel(string $class): void
    {
        // Without it the scholar's step falls back to the plain recommendation,
        // which asks them whether they recommend their own application.
        $view = (new $class)->view(['role' => 'student', 'locks' => []]);
        $this->assertSame(FormDefinition::VERSION, $view['version']);
        $this->assertArrayHasKey('student', $view['panels']);
        $this->assertNotEmpty($view['panels']['student']);
    }

    public function test_revise_title_asks_for_what_it_asked_before(): void
    {
        $this->assertSame([
            'revised_title' => 'required|string|max:1000',
            'revised_objectives' => 'required|array|min:1',
            'revised_objectives.*' => 'required|string|max:2000',
        ], (new ReviseTitleDefinition)->rules('student'));

        // Only the scholar enters anything; the rest recommend.
        foreach (['faculty', 'doctoral', 'phd_coordinator', 'hod', 'dordc'] as $step) {
            $this->assertSame([], (new ReviseTitleDefinition)->rules($step), $step);
        }
    }

    public function test_a_locked_or_foreign_reader_gets_no_inputs_and_no_submit(): void
    {
        $base = ['phd_title' => 'Old', 'objectives' => ['One'], 'revised_title' => 'New', 'revised_objectives' => ['Two']];
        $readers = [
            'scholar after submitting' => ['role' => 'student', 'locks' => ['student' => true]],
            'supervisor' => ['role' => 'faculty', 'locks' => ['student' => false]],
            'admin' => ['role' => 'admin', 'locks' => []],
        ];
        foreach ($readers as $who => $reader) {
            $rows = (new ReviseTitleDefinition)->view($base + $reader)['panels']['student'];
            $fields = collect($rows)->flatMap(fn ($row) => $row['kind'] === 'grid' ? $row['items'] : [$row]);
            $this->assertFalse($fields->contains('type', 'submit'), $who);
            $this->assertFalse($fields->contains(fn ($field) => ($field['locked'] ?? null) === false), $who);
        }
    }
}
