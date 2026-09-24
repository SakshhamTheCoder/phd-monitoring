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
 *   row_action = { label, icon, opens?: dialog name, request?: request }
 *   request = { method, path, confirm?, done, failed, failure?: 'message' | 'errors' }:
 *     {key} in path and confirm is that key of the row; failure says whether a
 *     refusal's field errors (errors) or only its message is shown
 *   dialog = { title, width?, min_width?, max_width?, min_height?, max_height?,
 *     close_outside, rows, request }: rows as a form's; a field's `from` names
 *     the row key it starts from when the dialog opens on a row
 *   import = { kind: 'file', title, columns, note, path }: a CSV file posted as it is
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

    /** A dialog's closing row: Cancel, then the button that sends it. */
    protected static function buttons(string $submit, string $cancel = 'Cancel'): array
    {
        return ['kind' => 'actions', 'items' => [Field::cancel($cancel), Field::submit($submit)->open()]];
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
