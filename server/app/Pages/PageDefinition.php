<?php

namespace App\Pages;

use App\Forms\Field;
use App\Forms\ResolvesRows;
use App\Models\User;

/**
 * A page of the portal described once, for the web and the app to draw: its
 * header, the table it lists, the dialogs its buttons and rows open, and the
 * CSV imports it takes. Resolved for one reader, so what they may do is
 * decided here and not again in each client. Answered by GET /views/{page}.
 *
 * Shape sent to clients (bump VERSION on any change a client must understand):
 *   { version, title, description?, actions: [ action ], table?, dialogs: { name: dialog },
 *     imports: { name: import } }
 *   action = { label, variant?, opens?: dialog or import name }
 *   table = { endpoint, search?: { path?, placeholder?, exclude? }, opens?: { dialog }
 *     | { navigate }, actions: [ row_action ] }: a paged list from endpoint;
 *     a row opens nothing unless opens says what
 *     | { kind: 'local', endpoint, search, class_prefix, loading, failed, empty,
 *         no_match, columns: [ { key, title, list_of? } ], lists?, actions }: a
 *       small list read whole and filtered in the browser; lists maps a filter
 *       key to a list on the row (department.name => departments[].name)
 *   row_action = { label, icon, opens?: dialog name, request?: request }
 *   request = { method, path, confirm?, done, failed, failure?: 'message' | 'errors',
 *     done_from_answer?, answer_says?, warnings_from?, invalidates?, loader? }:
 *     {key} in path, confirm and a dialog's title is that key of the row; failure
 *     says whether a refusal's field errors (errors), only its message, or the
 *     request's own report (fetch) is shown; done_from_answer shows the answer's
 *     own message when it has one; answer_says is [ { key, text } ], the first
 *     whose key the answer fills saying {key} filled from it; warnings_from names
 *     the answer's list of warnings, each shown; invalidates names lists a client
 *     keeps that the request changes ('departments'); loader false keeps the
 *     page's loader off
 *   dialog = { title, width?, min_width?, max_width?, min_height?, max_height?,
 *     close_outside, rows, request }: rows as a form's; a field's `from` names
 *     the row key it starts from when the dialog opens on a row
 *     | { block, width?, ... }: a block each client implements once
 *       ('department-manager'), opened on a row
 *   import = { kind: 'file', title, columns, note, path }: a CSV file posted as it is
 *     | { kind: 'rows', title, required, rules, sample: { name, csv }, path,
 *         confirm_first?, failed }: the CSV read in the browser and its rows
 *       posted as { rows }; the answer's messages ([ { tone, text } ]) are shown
 *       in order. With confirm_first the rows are posted with preview first,
 *       and the answer's confirm is asked before anything is written.
 */
abstract class PageDefinition
{
    use ResolvesRows;

    public const VERSION = 1;

    /** Whether $user, as the role they act in, may open the page at all. */
    abstract public function allows(User $user): bool;

    abstract public function view(User $user): array;

    /** A header button opening the dialog or import $opens. */
    protected static function action(string $label, string $opens, ?string $variant = null): array
    {
        return array_filter(['label' => $label, 'variant' => $variant, 'opens' => $opens], fn ($value) => $value !== null);
    }

    /**
     * A dialog: $props are its title, sizes and whether a click outside closes
     * it (close_outside); $request is where its submit sends the answers.
     */
    protected function dialog(array $props, array $rows, array $request): array
    {
        return $props + [
            'close_outside' => true,
            'rows' => $this->resolveRows($rows, []),
            'request' => $request,
        ];
    }

    /**
     * A dialog's closing row: Cancel, then the button that sends it, named or
     * given as a Field::submit carrying the checks it makes first.
     */
    protected static function buttons(string|Field $submit, string|Field|null $cancel = 'Cancel'): array
    {
        $submit = is_string($submit) ? Field::submit($submit) : $submit;
        $cancel = is_string($cancel) ? Field::cancel($cancel) : $cancel;
        return ['kind' => 'actions', 'items' => array_values(array_filter([$cancel, $submit->open()]))];
    }

    /** What a view carries whatever the page. */
    protected static function page(string $title, ?string $description, array $parts): array
    {
        return array_merge(
            array_filter(['version' => self::VERSION, 'title' => $title, 'description' => $description], fn ($value) => $value !== null),
            ['actions' => [], 'dialogs' => (object) [], 'imports' => (object) []],
            $parts
        );
    }
}
