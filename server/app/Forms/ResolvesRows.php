<?php

namespace App\Forms;

/**
 * Rows of fields as a client draws them: a row of fields side by side, a block
 * of rows, or a field on its own row. Shared by forms (FormDefinition) and pages
 * (App\Pages\PageDefinition), so a field reads the same wherever it is drawn.
 */
trait ResolvesRows
{
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
    protected static function row(array $items, ?int $space = null, ?int $each = null, ?string $label = null, ?array $showIf = null, ?array $ratio = null): array
    {
        return array_filter([
            'kind' => 'grid',
            'items' => $items,
            'space' => $space,
            'each' => $each,
            'label' => $label,
            'show_if' => $showIf,
            'ratio' => $ratio,
        ], fn ($value) => $value !== null);
    }

    /** A heading inside a dialog that names it, as a form of its own would. */
    protected static function heading(string $text): array
    {
        return ['kind' => 'heading', 'text' => $text];
    }

    /** A show_if test for row(): the answer $key is set, above $than, or equals or differs from it. */
    protected static function when(string $key, string $test = 'set', int|float|string $than = 0): array
    {
        return ['key' => $key, 'test' => $test, 'than' => $than];
    }

    protected function resolveRows(array $rows, array $data): array
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
        // A row that holds no fields (a heading) is drawn as it is.
        if (!isset($row['items'])) {
            return $row;
        }

        $items = array_values(array_filter(array_map(fn (Field $field) => $field->resolve($data), $row['items'])));
        // A row that only held a button nobody here may press goes; a row
        // declared empty (a scholar with no supervisors yet) stays, as the
        // hand-built panels drew it.
        return $items || !$row['items'] ? array_merge($row, ['items' => $items]) : null;
    }
}
