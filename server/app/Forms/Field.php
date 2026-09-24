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
    private const ANYONE = '*';

    private array $props;
    private ?string $editableBy = null;
    private bool $lockedAnyway = false;
    /** @var array{0: string, 1: string}|null ['editing'|'reading', step] */
    private ?array $shownWhile = null;
    private bool $shown = true;
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

    /**
     * A choice drawn as radio buttons.
     *
     * @param array<int, array{value: mixed, title: string}> $options
     */
    public static function radio(string $label, string $name, array $options): self
    {
        $field = new self('radio', $label);
        $field->props['name'] = $name;
        $field->props['options'] = array_values($options);
        return $field;
    }

    /** A notice inside a panel (tone: info, warning, success, danger). */
    public static function notice(string $text, string $tone = 'info'): self
    {
        $field = new self('notice', '');
        $field->props['text'] = $text;
        $field->props['tone'] = $tone;
        return $field;
    }

    /**
     * The scholar's publications on this form, with a picker to link more from
     * their library and a way to unlink them. The lists are read from the form
     * data under $lists and the library under $library; linking and unlinking
     * post to the form's own path plus /link and /unlink, and the form is read
     * again afterwards.
     */
    public static function publications(string $label, array $lists, string $library, bool $editable): self
    {
        $field = new self('publications', $label);
        $field->props['lists'] = $lists;
        $field->props['library'] = $library;
        $field->props['editable'] = $editable;
        return $field;
    }

    /**
     * Matches fetched from $source (POST { areas, ...$params, limit }) for the
     * entries of the list $from, as they change. Each match can be picked into
     * the next free box of the list $fills. Drawn as a row of its own.
     */
    public static function recommender(string $label, string $source, string $from, string $fills, array $params = [], int $limit = 8): self
    {
        $field = new self('recommender', $label);
        $field->props += ['source' => $source, 'from' => $from, 'fills' => $fills, 'params' => $params, 'limit' => $limit];
        return $field;
    }

    /**
     * A list of examiners: search the directory or add one through a dialog,
     * and remove one. $removePath deletes a saved row ({id} is the row); the
     * lists named in $together are checked together for repeats.
     */
    public static function examiners(string $label, string $source, string $removePath, array $together): self
    {
        $field = new self('examiners', $label);
        $field->props += ['source' => $source, 'remove_path' => $removePath, 'together' => $together];
        return $field;
    }

    /**
     * A table with an Accept or Reject choice on each row, kept as two lists of
     * row ids: $accepted and $rejected (the field's key is the first). Several
     * tables may share the same two lists.
     *
     * @param array<string, string> $columns row key => column title
     */
    public static function decisions(string $label, array $columns, array $rows, string $accepted, string $rejected, string $choiceTitle): self
    {
        $field = new self('decisions', $label);
        $field->props['columns'] = array_map(fn ($key, $title) => ['key' => $key, 'title' => $title], array_keys($columns), array_values($columns));
        $field->props['rows'] = array_values($rows);
        $field->props['key'] = $accepted;
        $field->props['rejects'] = $rejected;
        $field->props['choice_title'] = $choiceTitle;
        return $field;
    }

    /**
     * A leave application: its type, the dates as a range, the part of a
     * single day, the reason, and a document for the types that need one, with
     * the scholar's balance for the type chosen. It posts to the form's own
     * path and reads the form again after; a draft can be deleted there too.
     */
    public static function leave(array $props): self
    {
        $field = new self('leave', '');
        $field->props += $props;
        return $field;
    }

    /** Label and value pairs read out in a block, a value optionally as a badge. */
    public static function facts(array $facts, string $className = ''): self
    {
        $field = new self('facts', '');
        $field->props['facts'] = $facts;
        $field->props['class_name'] = $className;
        return $field;
    }

    /** A value posted with the answers as it stands, not drawn. */
    public static function hidden(string $key): self
    {
        $field = new self('hidden', '');
        $field->props['key'] = $key;
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
        // A column is 'key' => 'Title', or 'key' => ['title' => ..., 'format' =>
        // 'title-case'] for text shown with each word capitalised.
        $field->props['columns'] = array_map(
            fn ($key, $title) => is_array($title) ? ['key' => $key] + $title : ['key' => $key, 'title' => $title],
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

    /** A dialog's button that closes it without sending anything. */
    public static function cancel(string $label = 'Cancel'): self
    {
        return new self('cancel', $label);
    }

    /** A Cancel that cannot be pressed while the dialog's request is in flight. */
    public function heldWhileSending(): self
    {
        $this->props['held_while_sending'] = true;
        return $this;
    }

    /** Sent with the spaces around it taken off. */
    public function trimmed(): self
    {
        $this->props['trim'] = true;
        return $this;
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

    /**
     * A number that may not go above $max: typed higher, it is set to $max and
     * $message is shown, so the box holds what will be sent.
     */
    public function capped(float $max, string $message): self
    {
        $this->props['max'] = self::number($max);
        $this->props['max_message'] = $message;
        return $this;
    }

    /** A whole number as an integer, so it reads the same after a trip through JSON. */
    private static function number(float $value): int|float
    {
        return floor($value) === $value ? (int) $value : $value;
    }

    /**
     * Shows $base plus the number in $key, as it is typed. A null base shows as
     * no number (NaN), as the page it replaces did.
     */
    public function runningTotal(?float $base, string $key): self
    {
        $this->props['total_of'] = ['base' => $base === null ? null : self::number($base), 'key' => $key];
        return $this;
    }

    /**
     * Drawn only while the answer $key passes: 'set' (truthy), 'above' $than,
     * 'equals' $than or 'differs' from $than. Checked as the reader answers, so
     * a part can follow a choice.
     */
    public function showIf(string $key, string $test = 'set', int|float|string $than = 0): self
    {
        $this->props['show_if'][] = ['key' => $key, 'test' => $test, 'than' => $than];
        return $this;
    }

    /** Drawn only when $shown, a condition the server already knows. */
    public function onlyIf(bool $shown): self
    {
        $this->shown = $shown;
        return $this;
    }

    /** A submit that refuses, with $message, until a file is picked for $key. */
    public function requiresFile(string $key, string $message): self
    {
        $this->props['requires'][] = ['keys' => [$key], 'message' => $message, 'check' => 'file'];
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

    /** The chain step whose holder may edit this, while their step is unlocked. */
    public function editableBy(string $step): self
    {
        $this->editableBy = $step;
        return $this;
    }

    /** Read-only for everyone when $condition holds, e.g. a value already on record. */
    public function lockedIf(bool $condition): self
    {
        $this->lockedAnyway = $condition;
        return $this;
    }

    /** Editable by whoever the page is drawn for, as a dialog's fields are. */
    public function open(): self
    {
        $this->editableBy = self::ANYONE;
        return $this;
    }

    /** The kind of input: 'email' or 'number' rather than plain text. */
    public function inputType(string $type): self
    {
        $this->props['input_type'] = $type;
        return $this;
    }

    /**
     * Where a dialog opened on a table row takes the value from: the first of
     * $sources the row fills, each a key or a list of keys read as words
     * joined by spaces. A dialog opened with no row keeps the field's value.
     */
    public function from(string|array ...$sources): self
    {
        $this->props['from'] = $sources;
        return $this;
    }

    /** What a pick in a search box sets, as answer key => key of the match. */
    public function picks(array $keys): self
    {
        $this->props['picks'] = $keys;
        return $this;
    }

    /**
     * Answers a pick in a search box empties when it changes the search's own
     * answer: a choice that belonged to the old pick (an area of the old
     * department) is not kept against the new one.
     */
    public function clears(array $keys): self
    {
        $this->props['clears'] = $keys;
        return $this;
    }

    /** Where a dialog opened on a row takes a search box's shown text from. */
    public function displayFrom(string $key): self
    {
        $this->props['display_from'] = $key;
        return $this;
    }

    /** Like from(), for a row value that is a list, read as its entries joined by $glue. */
    public function fromJoined(string $key, string $glue): self
    {
        $this->props['from'][] = ['key' => $key, 'join' => $glue];
        return $this;
    }

    /**
     * Never posted: a value read only to decide what is shown (the kind of
     * record a dialog was opened on).
     */
    public function neverSent(): self
    {
        $this->props['send'] = 'never';
        return $this;
    }

    /**
     * A select whose options are read from $path (GET, the list under
     * response.data) when it is drawn: each option's value is $value and its
     * title fills {key} placeholders in $title from the entry. With
     * $dependsOn, {key} in the path is filled from the answers and the
     * options are read again, and the choice starts over, whenever that answer
     * changes; with it empty there are no options.
     */
    public function optionsFrom(string $path, string $value, string $title, ?string $dependsOn = null): self
    {
        $this->props['options_from'] = array_filter(
            ['path' => $path, 'value' => $value, 'title' => $title, 'depends_on' => $dependsOn],
            fn ($part) => $part !== null
        );
        return $this;
    }

    /**
     * A submit that refuses, with $message, while any of $keys is empty; with
     * $if, only while those show_if tests pass.
     */
    public function requiresAll(array $keys, string $message, ?array $if = null): self
    {
        $this->props['requires'][] = array_filter(['keys' => $keys, 'message' => $message, 'check' => 'truthy', 'if' => $if]);
        return $this;
    }

    /**
     * Posted with the answers even while locked, as a dialog fixing a value
     * for this reader (their own department) still sends it.
     */
    public function alwaysSent(): self
    {
        $this->props['send'] = 'always';
        return $this;
    }

    /**
     * A submit that refuses, with $message, while any of $keys is blank once
     * trimmed; with $if, only while those show_if tests pass.
     */
    public function requiresFilled(array $keys, string $message, ?array $if = null): self
    {
        $this->props['requires'][] = array_filter(['keys' => $keys, 'message' => $message, 'check' => 'filled', 'if' => $if]);
        return $this;
    }

    /** A submit that refuses, with $message, while $key does not read as a number. */
    public function requiresNumber(string $key, string $message): self
    {
        $this->props['requires'][] = ['keys' => [$key], 'message' => $message, 'check' => 'number'];
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
        if (!$this->shown) {
            return null;
        }
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

        if ($this->props['type'] === 'cancel') {
            return $this->props;
        }
        if ($this->props['type'] === 'submit') {
            return $this->isEditable($data) ? $this->props : null;
        }

        $editable = $this->isEditable($data) && !$this->lockedAnyway;

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
            // Adding a box is for the step's holder, unless the definition says
            // otherwise.
            $resolved['addable'] = $this->isEditable($data);
        }
        return $resolved;
    }

    private function isEditable(array $data): bool
    {
        if ($this->editableBy === self::ANYONE) {
            return true;
        }
        return $this->editableBy !== null && FormDefinition::mayEdit($data, $this->editableBy);
    }
}
