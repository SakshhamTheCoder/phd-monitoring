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
 *   { version, title, panels: { <step>: [ row, ... ] } }
 *   row = { kind: 'grid', items: [field, ...], space?, each?, label? }
 *       | { kind: 'list', ...list field }
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

    public function view(array $data): array
    {
        $panels = [];
        foreach ($this->panels($data) as $step => $rows) {
            $panels[$step] = array_values(array_filter(array_map(
                fn ($row) => $this->resolveRow($row, $data),
                $rows
            )));
        }

        return [
            'version' => self::VERSION,
            'title' => $this->title(),
            'panels' => $panels,
        ];
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
            foreach ($rows as $row) {
                foreach ($row instanceof Field ? [$row] : $row['items'] as $field) {
                    $rules += $field->rulesFor($step);
                }
            }
        }
        return $rules;
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

    /** A row of fields side by side; see GridContainer on the web for space and each. */
    protected static function row(array $items, ?int $space = null, ?int $each = null, ?string $label = null): array
    {
        return array_filter([
            'kind' => 'grid',
            'items' => $items,
            'space' => $space,
            'each' => $each,
            'label' => $label,
        ], fn ($value) => $value !== null);
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

    private function resolveRow(array|Field $row, array $data): ?array
    {
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
