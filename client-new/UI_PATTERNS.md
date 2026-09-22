# Portal UI Patterns — What exists and what to follow

> All new screens must reuse these. Do not recreate tables, modals, buttons or field styles. If a pattern is missing, add it to `styles/ui.css` or `components/*`, not as page-local CSS.

## Narrow screens
- **One breakpoint:** `max-width: 768px`, the value `--break-mobile` documents and the shell's drawer uses. A second tier at `480px` exists on the landing and team pages, for phones too narrow for two columns. Do not invent a third; 600, 640, 720 and 560 were merged into 768.
- **Where the rules live:** shared patterns in `styles/ui.css` (one block at the end), a page's own layout beside the layout it changes. Every rule sits inside a `max-width` query, so nothing above 768px moved.
- **What the shared block covers** (`ui.css`): page header stacks, dialog footers stack and stretch, `.form-list-container` scrolls sideways instead of widening the page, `.card`/`.empty-state` lose padding, row-action menus are capped at the viewport.
- **Tables:** they scroll inside their card. Do not rebuild a table as cards for a phone.
- **Grids:** `GridContainer` collapses to one column and `span-2`/`span-3` collapse with it. A grid cell holding a table also needs `min-width: 0`, or the table holds the grid open.
- **Dialogs:** `CustomModal` caps every width at `min(<width>, 100%)`, so a `width="520px"` dialog fits a 390px screen. Pass the desktop width and leave the phone to the cap.
- **Checked by:** `e2e-local/tests/mobile-audit.spec.js` (no page or dialog scrolls sideways at 390px) and `desktop-parity.spec.js` (nothing changed at 1440px).

## Tokens
- **File:** `src/index.css:18` defines `--primary-color`, `--hover-color`, `--primary-tint/wash`, `--surface`, `--text-color/muted/subtle`, `--border-color/subtle`, `--danger/success/warning`, `--radius*`.
- Use tokens, never hard-code `#B22626` / `#932f2f` again (there were 4 maroons).

## Layout
- **Component:** `src/components/dashboard/layout.js:6` + `layout.css` — sidebar `NavBar` + `TopBar` + `.content`.
- Every app page: `<Layout><PageHeader/>…</Layout>`. Public pages use `.page-navbar` from `index.css:56`.

## PageHeader
- **Component:** `src/components/pageHeader/PageHeader.js:5` — props `title`, `subtitle`, `actions`.
- **CSS:** `src/styles/ui.css:19` `.page-header`, `.page-title` (1.75rem/700), `.page-subtitle` (0.9rem muted).
- Example (Users): `<PageHeader title="Manage Users" subtitle="Create accounts…" />` (`src/pages/users/UsersPage.js:306`, `src/pages/department/Department.js:49`). Clerk/Attendance follow same.

## FilterBar
- **Component:** `src/components/filterBar/FilterBar.js:9` — fetches `GET {pathname}/filters`, renders Select Filter + Operator + Value (DropdownField / InputSuggestions / date/number/text) + Add + AND/OR + Search. Chips in `.filter-chip`.
- Use for any list page needing server-side filtering. `UsersPage` + `DepartmentPage` both do: `<FilterBar onSearch={handleFilterChange} />` + `<PagenationTable filters={filter} />`.

## Shared bits that used to be copied
- `.page-back-link` (`ui.css`) — the uppercase back link above a page title. Was `.cp-`/`.pd-`/`.pr-back-link`, three identical copies.
- `.inline-add-btn` + `.inline-add-btn--sm` (`ui.css`) — the small brand Add button inside a section. Was `.cp-add-btn`/`.cp-add-inline`, defined in one page's stylesheet and used from two.
- `.form-container` / `.form-note` (`ui.css`) — the padded block a form is drawn in. Was `pages/forms/forms.css`, which a component two directories away reached across to import.
- Table chrome (`ui.css`): `.form-list-container`, `.selected-row`, `.pagination`, `.table-bottom`, `.rows-per-page`, `.top-actions`. Was two files both called `FormList.css`, both global, disagreeing on `.form-table`'s background and on where the pager's margin sat. Each component now asks for its own difference by name: `.table-bottom--paged` (PagenationTable), `.table-bottom--list` (FormTable), `.form-table--tint` (PagenationTable's grey rows).
- **Rule:** a page stylesheet is global once its route chunk loads. Two pages defining the same class is a bug even when the values match today. Put it in `ui.css` or give it the page's own prefix.

## Tables — one look, three names
- **CSS:** `src/styles/ui.css:244` `.data-table-wrap`, `.data-table/.form-table/.custom-table` share same header (uppercase 0.72rem, `#F5F5F5`), cells, hover.
- **Container:** `src/styles/ui.css` `.form-list-container` (padding 20px, `#f7f1f1` card), `.table-toolbar` (title left, actions right), `.top-actions/.extra-components`.
- **PagenationTable:** `src/components/pagenationTable/PagenationTable.js:9` — props `endpoint`, `filters`, `enableApproval`, `customOpenForm`, `extraTopbarComponents`, `actions[]`, `num`. Handles paginate, selectMode, row-actions kebab. Toolbar pattern: `extraTopbarComponents={<div style={{display:'flex',gap:'10px'}}><CustomButton …/></div>}` (Users: Bulk Import + Add User).
- **When to use:** Server-paginated lists → `PagenationTable`. Client roster (Attendance) → `<div className="form-list-container"><table className="form-table">` manually but same classes (Attendance does this).
- **Row actions:** `.row-actions` + `.row-actions-trigger` + `.row-actions-menu` + `.row-actions-item` (`.danger` variant) — `PagenationTable.js:194`.
- **Badges in cells:** `src/styles/ui.css:217` `.badge` + `--*` variants (`neutral/success/warning/danger/info/blue/purple/accent`). Use for department chips, status.

## Badges / Empty / Card / Tabs
- **Badges:** `ui.css:217` — e.g. `<span className="badge badge--blue">{dept.name}</span>`, `badge--neutral` for Not assigned, `badge--danger` for absent count. Used in ClerkManagement, Attendance.
- **Empty:** `ui.css:99` `.empty-state` — grey panel, used when no clerks / no departments assigned.
- **Card:** `ui.css:110` `.card` — attendance history could use this.
- **Tabs:** `ui.css:52` `.tabs` + `.tab.active` (underline brand) — e.g. presentation semesters.
- **Section heading:** `ui.css:118` `.section-heading`.

## Buttons — CustomButton
- **Component:** `src/components/forms/fields/CustomButton.js:2` — `text`, `variant` (`secondary` = outlined brand, `danger`, `success`), `disabled`, `style` (escape hatch, avoid). CSS `src/components/forms/fields/Fields.css:5` `.custom-button` (maroon) + modifiers.
- **Toolbar sizing:** `ui.css` `.top-actions` + `.select-btn/.approve-btn` same size — so toolbar buttons align.
- **Pattern:** Primary action brand filled, secondary outlined. Do not use raw `<button>` with inline maroon unless copying bulk-import orange exception (see below).

## Fields — the form kit
- **CSS:** `Fields.css:189` `.input-label` (0.85rem/600/#444), `.input-field` (padding 0.6rem 0.8rem, border, focus `var(--primary-color)` ring) — unified across `InputField`, `DropdownField`, `DateField`, `InputSuggestions`, `GridContainer`.
- **GridContainer:** `src/components/forms/fields/GridContainer.js:4` — `elements[]`, `space`, `ratio`, `label`. 3-col grid `gap:2rem` (`Fields.css:143`). Used in `StudentForm:117`, `FacultyForm:103`, `ClerkForm`, `UserForm:209` (`space={2}` etc).
- **Patterns:** `GridContainer + InputField/DropdownField`, `field-stack` (`ui.css:182`) for vertical stacks in modals, `modal-note` (`ui.css:191`) for explanatory notes.

## Modals — CustomModal
- **Component:** `src/components/forms/modal/CustomModal.js:4` — `isOpen`, `onClose`, `title`, `width` (e.g. `520px` picker, `80vw` form, `90vw` bulk), `maxHeight 90vh`. Overlay `modal-overlay`, panel `modal-content`, close `modal-close-button`, divider `modal-title` (`CustomModal.css:47`/`ui.css:129`).
- **Footer:** `ui.css:137` `.modal-actions` (flex end, gap, top border). Use with `CustomButton` pair (Cancel secondary + Save primary). Bulk import is the one outlier using plain `<button>` with inline styles to match orange primary — keep identical if copying that modal.

## Bulk CSV — the one true pattern
- **Reference:** `src/pages/users/UsersPage.js:370` (`showBulkImportModal`).
- **Structure:** `CustomModal title="Bulk Import Users" width="90vw"` → `div.modal-form` → `div.info-box` (`#f0f9ff`/`#bae6fd`, CSV Format + Required/Optional) → `CustomButton text="Download Sample CSV" style={{backgroundColor:'#FF9800',...}}` → `<input type="file" accept=".csv">` (padding/border) → `csvPreview` (`csv-preview-wrap`/`csv-preview` from `ui.css:150`) → `uploadProgress` (`#f0f9ff` bar) → footer `display:flex justify flex-end gap 1rem` with plain Cancel (white) + Import (primary/`#9ca3af` disabled). Logic: `handleFileChange` parse, `handleBulkImport` batched `BATCH_SIZE 50` + retry.
- **Rule:** Template/Sample button lives **inside modal only**, not in `PageHeader` actions. `PageHeader` / toolbar shows only `Bulk Import CSV` (+ `Add User`). Attendance CSV must follow this: `PageHeader` shows `Upload CSV` + `Export` (+ `Save`), modal shows `Download Template` + file + preview + Cancel/Upload. Fixed in `src/pages/attendance/AttendancePage.js:287` (`0faed4a`).

## Form flows — add/edit
- **User creation:** `UsersPage:342` picker `NewUserKindPicker` (`src/components/userForm/NewUserKindPicker.js:12`: Student/Faculty/Clerk/Office) → `StudentForm` (`POST /students/add`) / `FacultyForm` (`POST /faculty/add`) / `ClerkForm` (`src/components/clerkForm/ClerkForm.js:1` → `POST /users` with `clerk` role) / `UserForm` (`src/components/userForm/UserForm.js:204` generic with `available_roles` grid). All in one `CustomModal isOpen={isOpen}` width `520px` picker or `80vw` form, `onClose` vs `onSuccess` distinction for refresh.
- **Edit:** Same modal, `editData` bypasses picker → `UserForm edit`.
- **Clerk tagging:** `src/pages/admin/ClerkManagement.js:30` — `PageHeader` + `form-list-container`/`form-table` + `CustomModal width="560px"` for department checkboxes (grid like UserForm available_roles). Same `ClerkForm` reused via `Add Clerk +` in `PageHeader actions` (pattern from `FacultyForm`/`StudentForm`).

## Do / Don't
- **Do:** Reuse `PageHeader`, `Layout`, `form-list-container`/`form-table`, `badge`, `empty-state`, `CustomModal`/`modal-actions`/`modal-note`, `CustomButton` variant, `GridContainer`/`InputField`/`DropdownField`, `FilterBar`+`PagenationTable` for server lists, `csv-preview` for imports.
- **Don't:** Create page-local `.clerk-table`, `.attendance-page`, new modal CSS, or raw `<button style maroon>`. Template belongs in modal, not toolbar. Never hard-code colors — use tokens.

