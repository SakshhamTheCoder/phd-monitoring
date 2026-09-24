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
    /** @var array{0: string, 1: string}|null ['editing'|'reading', step] */
    private ?array $shownWhile = null;
    private ?string $rules = null;
    private ?string $itemRules = null;
    private mixed $value = null;
    private bool $hasValue = false;
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
     * A choice from a list.
     *
     * @param array<int, string|array{value: mixed, title: ?string}> $options
     *   a plain string is its own value and title
     */
    public static function select(string $label, array $options): self
    {
        $field = new self('select', $label);
        $field->props['options'] = array_map(
            fn ($option) => is_array($option) ? $option : ['value' => $option, 'title' => $option],
            array_values($options)
        );
        return $field;
    }

    /**
     * A search box that offers matches from $source (an API path answering
     * POST {text}) and keeps the id of the one picked.
     */
    public static function suggest(string $label, string $source): self
    {
        $field = new self('suggest', $label);
        $field->props['source'] = $source;
        return $field;
    }

    /**
     * A row of buttons, each pressed or not, keeping the values pressed. Drawn
     * as a row of its own, with the label above it.
     *
     * @param array<int, array{value: mixed, title: string}> $options a list,
     *   not a map: codes like "0101" must reach the client as they are stored
     */
    public static function toggles(string $label, array $options): self
    {
        $field = new self('toggles', $label);
        $field->props['options'] = array_values($options);
        return $field;
    }

    /** A number stepped with - and + buttons. */
    public static function counter(string $label): self
    {
        return new self('counter', $label);
    }

    /**
     * The shared recommendation block (Recommend / Not recommend and remarks)
     * for $role, drawn inside a panel that has more to ask, so the panel's own
     * submit sends the choice with its answers. Its value is the choice already
     * made, or null while the step is unanswered.
     */
    public static function recommendation(string $role, bool $allowRejection = false): self
    {
        $field = new self('recommendation', '');
        $field->props['role'] = $role;
        $field->props['allow_rejection'] = $allowRejection;
        $field->props['key'] = 'approval';
        return $field;
    }

    /** An empty cell that keeps a row's columns where they were. */
    public static function blank(): self
    {
        return new self('blank', '');
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
        return $field->value(array_values($rows));
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
        $this->hasValue = true;
        return $this;
    }

    /** What an editor starts from, when that differs from the saved value. */
    public function draft(mixed $value): self
    {
        $this->draft = $value;
        $this->hasDraft = true;
        return $this;
    }

    /** Marked with an asterisk. The rule that enforces it is set in rules(). */
    public function required(bool $required = true): self
    {
        if ($required) {
            $this->props['required'] = true;
        }
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

    /**
     * A search box that keeps whatever is typed, offering matches only as a
     * start; its value is the text, not an id.
     */
    public function free(): self
    {
        $this->props['free'] = true;
        return $this;
    }

    /** Extra values a search box sends with the typed text. */
    public function params(array $params): self
    {
        $this->props['params'] = $params;
        return $this;
    }

    /** Which parts of a match a search box shows, e.g. ['name', 'department']. */
    public function shows(array $parts): self
    {
        $this->props['shows'] = $parts;
        return $this;
    }

    /** Text a search box shows for its value before anything is typed. */
    public function display(?string $text): self
    {
        $this->props['display'] = $text;
        return $this;
    }

    /** A label the field draws above itself is left off (a row label says it). */
    public function hideLabel(): self
    {
        $this->props['show_label'] = false;
        return $this;
    }

    /** A submit that refuses, with $message, while $key has no value. */
    public function requires(string $key, string $message): self
    {
        $this->props['requires'][] = ['keys' => [$key], 'message' => $message, 'check' => 'set'];
        return $this;
    }

    /** A submit that refuses, with $message, while $when is truthy and any of $keys is empty. */
    public function requiresWhen(string $when, array $keys, string $message): self
    {
        $this->props['requires'][] = ['keys' => $keys, 'when' => $when, 'message' => $message, 'check' => 'truthy'];
        return $this;
    }

    /** Fixed values a submit button posts with the answers. */
    public function sends(array $values): self
    {
        $this->props['sends'] = $values;
        return $this;
    }

    /**
     * Drawn only while $step's holder may edit it ('editing'), or only while
     * they may not ('reading'): a form swaps its inputs for a summary once sent.
     * 'locked' and 'open' ask only whether the step is submitted, whoever reads.
     */
    public function onlyWhile(string $mode, string $step): self
    {
        $this->shownWhile = [$mode, $step];
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
        if ($this->shownWhile) {
            [$mode, $step] = $this->shownWhile;
            $shown = match ($mode) {
                'editing' => FormDefinition::mayEdit($data, $step),
                'reading' => !FormDefinition::mayEdit($data, $step),
                'locked' => !FormDefinition::mayEdit($data, $step, anyReader: true),
                'open' => FormDefinition::mayEdit($data, $step, anyReader: true),
            };
            if (!$shown) {
                return null;
            }
        }

        if ($this->props['type'] === 'submit') {
            return $this->isEditable($data, false) ? $this->props : null;
        }

        $editable = $this->isEditable($data, $this->anyReader) && !$this->lockedAnyway;

        $resolved = $this->props;
        // A value never given stays out, so a client's own default applies
        // (a counter starts at 0), as it did when the page read a missing key.
        if ($editable && $this->hasDraft) {
            $resolved['value'] = $this->draft;
        } elseif ($this->hasValue) {
            $resolved['value'] = $this->value;
        }
        if ($this->props['type'] !== 'table') {
            $resolved['locked'] = !$editable;
        }
        if ($this->props['type'] === 'list' && !array_key_exists('addable', $resolved)) {
            // Adding a box is for the step's holder only, even where any reader
            // sees the boxes open, unless the definition says otherwise.
            $resolved['addable'] = $this->editableBy !== null && FormDefinition::mayEdit($data, $this->editableBy);
        }
        return $resolved;
    }

    private function isEditable(array $data, bool $anyReader): bool
    {
        return $this->editableBy !== null && FormDefinition::mayEdit($data, $this->editableBy, $anyReader);
    }
}
