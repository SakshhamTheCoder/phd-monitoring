<?php

namespace App\Forms;

/**
 * One thing a form panel shows: a value, an input, a table, a list of inputs,
 * or the panel's submit button.
 *
 * A field is declared once, in a FormDefinition. The same declaration gives
 * the web and the app what to draw (resolve) and gives the controller the
 * rules a submission must pass (rulesFor), so the label a scholar reads and
 * the rule the server applies cannot drift apart.
 */
final class Field
{
    private array $props;
    private ?string $editableBy = null;
    private bool $anyReader = false;
    private bool $lockedAnyway = false;
    private ?string $rules = null;
    private ?string $itemRules = null;
    private mixed $value = null;
    private mixed $draft = null;
    private bool $hasDraft = false;

    private function __construct(string $type, string $label)
    {
        $this->props = ['type' => $type, 'label' => $label];
    }

    /** A single line of text: an input when editable, a read-only box otherwise. */
    public static function text(string $label): self
    {
        return new self('text', $label);
    }

    /** A date picker when editable, the formatted date otherwise. */
    public static function date(string $label): self
    {
        return new self('date', $label);
    }

    /** A PDF upload when editable, a link to the stored file otherwise. */
    public static function file(string $label): self
    {
        return new self('file', $label);
    }

    /**
     * A read-only table.
     *
     * @param array<string, string> $columns row key => column title
     * @param array<int, array<string, mixed>> $rows
     */
    public static function table(string $label, array $columns, array $rows): self
    {
        $field = new self('table', $label);
        $field->props['columns'] = array_map(
            fn ($key, $title) => ['key' => $key, 'title' => $title],
            array_keys($columns),
            array_values($columns)
        );
        $field->value = array_values($rows);
        return $field;
    }

    /**
     * A list of text inputs the person can add to. Blank entries are dropped
     * on submit. Once locked it reads as a one-column table.
     */
    public static function list(string $label): self
    {
        return new self('list', $label);
    }

    /** The panel's submit button. Drawn only for the person who may edit. */
    public static function submit(string $label): self
    {
        return new self('submit', $label);
    }

    public function key(string $key): self
    {
        $this->props['key'] = $key;
        return $this;
    }

    /** What the field shows once it is read-only. */
    public function value(mixed $value): self
    {
        $this->value = $value;
        return $this;
    }

    /** What an editor starts from, when that differs from the saved value. */
    public function draft(mixed $value): self
    {
        $this->draft = $value;
        $this->hasDraft = true;
        return $this;
    }

    public function required(): self
    {
        $this->props['required'] = true;
        return $this;
    }

    /** Placeholder text inside an empty input. */
    public function hint(string $hint): self
    {
        $this->props['hint'] = $hint;
        return $this;
    }

    /** Largest upload a file field takes, in megabytes. */
    public function maxMb(int $megabytes): self
    {
        $this->props['max_mb'] = $megabytes;
        return $this;
    }

    /**
     * Posted only once the person changes it, rather than as prefilled. For a
     * field whose rule reads a missing key differently from an empty one.
     */
    public function sentOnlyIfChanged(): self
    {
        $this->props['send'] = 'changed';
        return $this;
    }

    /** How a client formats the value for reading, e.g. 'date'. */
    public function format(string $format): self
    {
        $this->props['format'] = $format;
        return $this;
    }

    /**
     * The chain step whose holder may edit this, while their step is unlocked.
     *
     * $anyReader keeps how the older hand-built panels drew it: open to whoever
     * reads the form until the step is submitted, though only the holder gets
     * the submit button, so nobody else can post it.
     */
    public function editableBy(string $step, bool $anyReader = false): self
    {
        $this->editableBy = $step;
        $this->anyReader = $anyReader;
        return $this;
    }

    /** Read-only for everyone when $condition holds, e.g. a value already on record. */
    public function lockedIf(bool $condition): self
    {
        $this->lockedAnyway = $condition;
        return $this;
    }

    /** Laravel rules for the key, and for each entry when the field is a list. */
    public function rules(string $rules, ?string $itemRules = null): self
    {
        $this->rules = $rules;
        $this->itemRules = $itemRules;
        return $this;
    }

    /** Type-specific display properties, e.g. a list's add button label. */
    public function with(array $props): self
    {
        $this->props = array_merge($this->props, $props);
        return $this;
    }

    /** The validation rules this field adds to a submission from $step. */
    public function rulesFor(string $step): array
    {
        if ($this->editableBy !== $step || $this->rules === null || !isset($this->props['key'])) {
            return [];
        }
        $key = $this->props['key'];
        return array_filter([
            $key => $this->rules,
            "$key.*" => $this->itemRules,
        ]);
    }

    /**
     * What a client draws for the reader described by $data, the form's
     * fullForm() payload. Null when there is nothing to draw.
     */
    public function resolve(array $data): ?array
    {
        if ($this->props['type'] === 'submit') {
            return $this->isEditable($data, false) ? $this->props : null;
        }

        $editable = $this->isEditable($data, $this->anyReader) && !$this->lockedAnyway;

        $resolved = $this->props;
        $resolved['value'] = $editable && $this->hasDraft ? $this->draft : $this->value;
        if ($this->props['type'] !== 'table') {
            $resolved['locked'] = !$editable;
        }
        return $resolved;
    }

    /**
     * Same rule the web panels applied before the server decided it: the
     * reader holds the step's role and has not yet submitted it. The supervisor
     * step is 'faculty' in a chain and 'supervisor' in the locks.
     */
    private function isEditable(array $data, bool $anyReader): bool
    {
        if ($this->editableBy === null || (!$anyReader && ($data['role'] ?? null) !== $this->editableBy)) {
            return false;
        }
        $lock = $this->editableBy === 'faculty' ? 'supervisor' : $this->editableBy;
        return empty($data['locks'][$lock]);
    }
}
