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
 *     step_options?: { <step>: { allow_rejection } }, summary?, sections? }
 *   sections = [ { title, rows }, ... ]: titled sections drawn in place of
 *     the chain, for a form that is not walked step by step
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
    use ResolvesRows;

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

    /** Titled sections drawn in place of the chain, as [['title' => ..., 'rows' => [...]]], or null. */
    protected function sections(array $data): ?array
    {
        return null;
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
        $sections = $this->sections($data);
        if ($sections !== null) {
            $view['sections'] = array_map(
                fn ($section) => ['title' => $section['title'], 'rows' => $this->resolveRows($section['rows'], $data)],
                $sections
            );
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
        $groups = array_merge(array_values($this->panels($data)), array_column($this->sections($data) ?? [], 'rows'));
        foreach ($groups as $rows) {
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
}
