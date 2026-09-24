<?php

namespace App\Forms;

/**
 * Everything the clients need to draw a form's own panels, declared once.
 *
 * The view is resolved for one reader from the form's fullForm() payload, so
 * what is editable, what a new form is prefilled with and which buttons show
 * are decided here and not again in each client. Steps without a panel here
 * keep the plain recommendation every chain step already gets.
 *
 * Shape sent to clients (bump VERSION on any change a client must understand):
 *   { version, title, notes: [ text, ... ], notices: [ notice, ... ], lead?, panels: { <step>: panel },
 *     step_options?: { <step>: { allow_rejection } }, summary? }
 *   lead = { title, wrapped, rows }: a section above the chain, for a form
 *     whose chain does not start with the scholar
 *   step_options: how a step's plain recommendation is drawn
 *   summary = { note, dates, rows }: drawn instead of the chain, for a record
 *     no step of which was answered here; {name} in the note is dates[name],
 *     formatted as a date
 *   panel = { wrapped, rows: [ row, ... ] }
 *   notice = { tone, text, action?: { label, endpoint, done, failed } }
 *   row = { kind: 'grid', items: [field, ...], space?, each?, label? }
 *       | { kind: 'list' | 'toggles' | 'recommendation' | 'publications'
 *           | 'recommender' | 'examiners' | 'hidden', ...that field }
 *       | { kind: 'group', hidden_unless?, class_name?, rows: [ row, ... ] }:
 *         a block kept on the page, hidden while that answer is empty
 *   A row or field with show_if is left off the page while an answer fails it.
 * `wrapped` is whether the panel sits in a block of its own, as most hand-built
 * panels did; a panel drawn straight into its step says false.
 *
 * Blocks with behaviour of their own (publications, recommender, examiners,
 * decisions) are placed and wired here and implemented once by each client.
 */
abstract class FormDefinition
{
    public const VERSION = 1;

    abstract public function title(): string;

    /**
     * Rows per chain step. Built from the fullForm() payload; with an empty
     * payload it must still build, since rules() reads the declarations only.
     *
     * @return array<string, array<int, array|Field>>
     */
    abstract protected function panels(array $data): array;

    /** Plain notes under the form's title, as paragraphs. */
    protected function notes(array $data): array
    {
        return [];
    }

    /**
     * Notices above the form for this reader, each with an optional action
     * posted to an API path.
     */
    protected function notices(array $data): array
    {
        return [];
    }

    /** A section drawn above the chain, as ['title' => ..., 'rows' => [...]], or null. */
    protected function lead(array $data): ?array
    {
        return null;
    }

    /** Per step, how its plain recommendation is drawn, e.g. ['director' => ['allow_rejection' => true]]. */
    protected function stepOptions(): array
    {
        return [];
    }

    /** Drawn instead of the chain, or null to draw the chain. */
    protected function summary(array $data): ?array
    {
        return null;
    }

    /** Steps whose panel is drawn without a block of its own around it. */
    protected function unwrapped(): array
    {
        return [];
    }

    public function view(array $data): array
    {
        $panels = [];
        foreach ($this->panels($data) as $step => $rows) {
            $panels[$step] = [
                'wrapped' => !in_array($step, $this->unwrapped(), true),
                'rows' => $this->resolveRows($rows, $data),
            ];
        }

        $view = [
            'version' => self::VERSION,
            'title' => $this->title(),
            'notes' => $this->notes($data),
            'notices' => $this->notices($data),
            'panels' => $panels,
        ];
        $lead = $this->lead($data);
        if ($lead !== null) {
            $view['lead'] = [
                'title' => $lead['title'],
                'wrapped' => $lead['wrapped'] ?? true,
                'rows' => $this->resolveRows($lead['rows'], $data),
            ];
        }
        if ($this->stepOptions()) {
            $view['step_options'] = $this->stepOptions();
        }
        $summary = $this->summary($data);
        if ($summary !== null) {
            $summary['rows'] = $this->resolveRows($summary['rows'], $data);
            $view['summary'] = $summary;
        }
        return $view;
    }

    /**
     * The validation rules for a submission from $step. $data is the form's
     * fullForm() payload, for rules that depend on it (an upload required only
     * while none is stored).
     */
    public function rules(string $step, array $data = []): array
    {
        $rules = [];
        foreach ($this->panels($data) as $rows) {
            foreach ($this->fieldsIn($rows) as $field) {
                $rules += $field->rulesFor($step);
            }
        }
        return $rules;
    }

    /** Every field declared in $rows, groups opened. */
    private function fieldsIn(array $rows): array
    {
        $fields = [];
        foreach ($rows as $row) {
            if ($row instanceof Field) {
                $fields[] = $row;
            } elseif (($row['kind'] ?? null) === 'group') {
                array_push($fields, ...$this->fieldsIn($row['rows']));
            } else {
                array_push($fields, ...$row['items']);
            }
        }
        return $fields;
    }

    /**
     * Whether this reader may answer $step now: they hold its role and have not
     * submitted it yet. $anyReader drops the role check, which only asks whether
     * the step is still open. The supervisor step is 'faculty' in a chain and
     * 'supervisor' in the locks.
     */
    public static function mayEdit(array $data, string $step, bool $anyReader = false): bool
    {
        if (!$anyReader && ($data['role'] ?? null) !== $step) {
            return false;
        }
        $lock = $step === 'faculty' ? 'supervisor' : $step;
        return empty($data['locks'][$lock]);
    }

    /**
     * Whether $role's step has been answered, so its stored approval is a
     * choice and not the column's default. Same as stepAnswered on the web.
     */
    protected static function stepAnswered(array $data, string $role): bool
    {
        if (empty($data['locks'][$role])) {
            return false;
        }
        $step = $role === 'supervisor' ? 'faculty' : $role;
        $index = array_search($step, $data['steps'] ?? [], true);
        if ($index === false || !isset($data['maximum_step'])) {
            return true;
        }
        return $index <= (int) $data['maximum_step'];
    }

    /** The payload as JSON has it, so dates and models read as a client reads them. */
    protected static function plain(mixed $value): mixed
    {
        return json_decode(json_encode($value), true);
    }

    /** "Supervisor 1", "Supervisor 2", ... read-only, one per supervisor. */
    protected static function supervisorFields(array $supervisors): array
    {
        return array_map(
            fn ($supervisor, $index) => Field::text('Supervisor ' . ($index + 1))->value($supervisor['name'] ?? null),
            array_values($supervisors),
            array_keys(array_values($supervisors))
        );
    }

    /**
     * Rows in a block of their own: hidden while the answer $hiddenUnless is
     * empty, and/or with a class (such as 'reveal', which fades them in).
     */
    protected static function group(array $rows, ?string $hiddenUnless = null, ?string $className = null): array
    {
        return array_filter(
            ['kind' => 'group', 'hidden_unless' => $hiddenUnless, 'class_name' => $className, 'rows' => $rows],
            fn ($value) => $value !== null
        );
    }

    /** A row of fields side by side; see GridContainer on the web for space and each. */
    protected static function row(array $items, ?int $space = null, ?int $each = null, ?string $label = null, ?array $showIf = null): array
    {
        return array_filter([
            'kind' => 'grid',
            'items' => $items,
            'space' => $space,
            'each' => $each,
            'label' => $label,
            'show_if' => $showIf,
        ], fn ($value) => $value !== null);
    }

    /** A show_if test for row(): the answer $key is set, or above $than. */
    protected static function when(string $key, string $test = 'set', int|float $than = 0): array
    {
        return ['key' => $key, 'test' => $test, 'than' => $than];
    }

    /** First value that is neither null nor an empty string or list. */
    protected static function firstFilled(mixed ...$values): mixed
    {
        foreach ($values as $value) {
            if ($value !== null && $value !== '' && $value !== []) {
                return $value;
            }
        }
        return null;
    }

    private function resolveRows(array $rows, array $data): array
    {
        return array_values(array_filter(array_map(fn ($row) => $this->resolveRow($row, $data), $rows)));
    }

    private function resolveRow(array|Field $row, array $data): ?array
    {
        if (is_array($row) && ($row['kind'] ?? null) === 'group') {
            return array_merge($row, ['rows' => $this->resolveRows($row['rows'], $data)]);
        }
        if ($row instanceof Field) {
            $field = $row->resolve($data);
            return $field === null ? null : ['kind' => $field['type']] + $field;
        }

        $items = array_values(array_filter(array_map(fn (Field $field) => $field->resolve($data), $row['items'])));
        // A row that only held a button nobody here may press goes; a row
        // declared empty (a scholar with no supervisors yet) stays, as the
        // hand-built panels drew it.
        return $items || !$row['items'] ? array_merge($row, ['items' => $items]) : null;
    }
}
