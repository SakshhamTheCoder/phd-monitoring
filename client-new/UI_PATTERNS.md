# Portal UI patterns

Every signed-in page is built from the pieces below. Reuse them; do not recreate a
table, card, button or field style in a page stylesheet. If a piece is missing, add
it to `src/styles/ui.css` or `src/components/*`, not as page-local CSS.

## The look

- **Identity:** brand red `--primary-color` (#B22626), Poppins throughout, white
  sidebar with the current page marked by a red bar and tint.
- **Colour:** neutral canvas (`--canvas`), white panels, one accent. Red means "the
  thing to press" or "where you are". Semantic colours only for state: success,
  danger, warning, info. Never hard-code a colour; every value is a token in
  `src/index.css`.
- **Type scale:** page title `--text-page` (1.5rem/600), panel title `--text-md`/600,
  section title `--text-base`/600, body `--text-sm`, small `--text-xs`. Weights
  400/500/600 only. Sentence case for headings, buttons, tabs and table headers.
- **Spacing:** `--space-1`..`--space-7` (4, 8, 12, 16, 24, 32, 48px).
- **Shape:** radius 6/8/12 (`--radius-sm`, `--radius`, `--radius-lg`). Panels have a
  border and no shadow; only things that float (menus, dialogs, the drawer, toasts)
  have a shadow.

## Page structure

```jsx
<Page title="Manage users" description="Create accounts and assign roles."
      actions={<CustomButton text="Add user" />} tabs={<Tabs ... />}>
  <PagenationTable search={<FilterBar ... />} ... />
  <Panel title="Details">...</Panel>
</Page>
```

- **Page** (`components/page/Page.jsx`): header band (title, one-line description,
  `meta` line for badges/ids, actions on the right, optional `tabs`) and the one
  gap between header and panels. The shell's `.content` owns the gutter. A page adds
  no padding, margin or wrapper of its own.
- **Panel** (`components/panel/Panel.jsx`): the one surface. Optional head (`title`,
  `description`, `actions`) of fixed minimum height, `flush` for an edge-to-edge
  table, `footer` for a pager or total. Panels never nest.
- **PanelSection**: a titled region inside a panel, divided by a rule. Form ladder
  steps are sections of the one form panel.
- **Side by side:** `.panel-columns` (2fr/1fr) with `.panel-stack` columns.
- **Facts:** `<dl className="facts">` (label over value) for a record's read-out;
  `<dl className="kv">` (label left, value right) in an aside.

## Tables

- **Server lists:** `PagenationTable` draws its own flush panel: `search` (pass the
  page's `<FilterBar>`), `tableTitle`, table actions in the head, pager as the foot.
- **Hand-drawn tables:** `<Panel flush title=...><div className="data-table-wrap">
  <table className="data-table">` (or `.form-table`). Headers sentence case.
- **Row actions:** `.row-actions` kebab menu, `.danger` for destructive items.
- Tables scroll inside their panel on a phone. Do not rebuild a table as cards.

## Forms

- **FieldRow = `GridContainer`:** one row is one group of related fields, 3 columns
  everywhere (deliberate: it carries the filling order). `space`/`ratio` span cells.
- **Field:** `InputField`, `DropdownField`, `DateField`, `FileUploadField`,
  `InputSuggestions` put the label over the control, with the `*` marker hidden from
  screen readers and `aria-required` on the control.
- **Locked values** (`isLocked`): same shape and grid slot as an input, full-contrast
  text, a lock at the right. They stay in the form where they always were.
- **FormActions** (`components/common/FormActions.jsx`): primary button first,
  `secondary` pushed right.
- **Form pages:** `FormTitleBar` is the page header (name, Form ID and Stage badges,
  View status for the history and steps); `.form-container` is the form panel.

## Buttons

`CustomButton`: default filled (one per view), `secondary` (outlined brand),
`quiet` (neutral outline: Cancel, Close, Back), `danger`, `success`, `size="sm"`.
Labels name the outcome in sentence case: "Add user", "Import from CSV".

## States

- **StatusNotice** (`components/common/StatusNotice.jsx`): `tone` = `empty`,
  `loading`, `error`, `info`, `warning`, with `title`, text and optional `action`.
- **LoadError**: a failed load with Try again; dismisses the request's toast.

## Tabs

`Tabs` (`components/tabs/Tabs.jsx`): underline, brand indicator, arrow keys move
between tabs. Put it in `Page`'s `tabs` slot when it switches the whole page.

## Dialogs

`CustomModal` with `.modal-actions` for the footer (quiet Cancel, filled primary).
`.field-stack` for stacked fields, `.modal-note` for an explanatory note.

## Narrow screens

One breakpoint, 768px. Header actions wrap under the title, `.panel-columns`
stacks, field rows go to one column, tables scroll inside their panel, dialogs cap
at the viewport width.

## Rule for stylesheets

A page stylesheet is global once its chunk loads. Two files defining the same class
is a bug even when the values match today: shared classes live in `ui.css`, page
classes carry the page's own prefix.
