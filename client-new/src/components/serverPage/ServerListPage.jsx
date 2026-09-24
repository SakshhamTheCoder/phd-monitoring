import React, { useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import Page from '../page/Page';
import PagenationTable from '../pagenationTable/PagenationTable';
import FilterBar from '../filterBar/FilterBar';
import CustomButton from '../forms/fields/CustomButton';
import DropdownField from '../forms/fields/DropdownField';
import LoadError from '../common/LoadError';
import Tabs from '../tabs/Tabs';
import { useLoading } from '../../context/LoadingContext';
import useScholarInPath from '../../hooks/useScholarInPath';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { fillFromRow, useView } from '../../api/views';
import { sendRequest } from './requests';
import ServerDialog from './ServerDialog';
import FileImportModal from './FileImportModal';
import RowsImportModal from './RowsImportModal';
import LocalTable from './LocalTable';
import SemesterStatsBlock from './blocks/SemesterStatsBlock';
import ProgressChartBlock from './blocks/ProgressChartBlock';
import FormCardsBlock from './blocks/FormCardsBlock';
// The session picker's styles; they move here with the URF projects page.
import '../../pages/urf/UrfList.css';

const IMPORTS = { file: FileImportModal, rows: RowsImportModal };

// Parts of a page above its list, which the server places by name.
const ABOVE = { 'semester-stats': SemesterStatsBlock, 'progress-chart': ProgressChartBlock };

// A page's content drawn in place of its table (a scholar's own forms as cards).
const CONTENT = { 'form-cards': FormCardsBlock };

// {name} in a view's paths and text filled from the page itself: its path,
// the route's parameters and the scholar it is about. A name the page does
// not know is left for the row.
const fillFromPage = (template, context) =>
  typeof template === 'string'
    ? template.replace(/\{(\w+)\}/g, (whole, name) => (name in context ? context[name] ?? '' : whole))
    : template;

/**
 * A list page as the server describes it (GET /views/{page}, server:
 * App\Pages): the header and its buttons, the table and its row actions, and
 * the dialogs and imports they open. Nothing here knows which page it is.
 */
const ServerListPageFor = ({ page }) => {
  const params = useParams();
  // The route's parameters go with the question: a form type's list is its own.
  const { view, failed, retry, reload } = useView(page, params);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const scholar = useScholarInPath();
  const { setLoading } = useLoading();
  // Null until searched: each table starts from the filters its view gives.
  const [filters, setFilters] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // A page with tabs draws one list at a time; each tab has its own table and buttons.
  const [tab, setTab] = useState(null);
  // The dialog open now, the row it was opened on, and which opening it is.
  // One dialog at a time, drawn in one place, so a dialog that hands over to
  // another (a choice) changes in place rather than closing and opening.
  const [dialog, setDialog] = useState(null);
  // The last dialog shown, so it keeps its size while it closes.
  const lastDialog = useRef(null);
  const [importing, setImporting] = useState(null);
  // What the page's scope picker is on (a URF session), until it is changed
  // the view's own default.
  const [scopeValue, setScopeValue] = useState(null);
  // Whether a search a part above the list can show is showing; until
  // toggled, whatever the tab opened on says.
  const [searchShown, setSearchShown] = useState(null);

  const context = { path: pathname, ...params, scholar: scholar?.label };

  const shownTab = view?.tabs ? view.tabs.find((each) => each.value === (tab ?? view.tab)) || view.tabs[0] : null;
  const table = view ? (shownTab || view).table ?? null : null;

  // What the table is asked for: the search (or the tab's own filters), and
  // the scope picked. One object per change, so the table asks once for it.
  const query = useMemo(() => {
    if (!table) return null;
    const base = filters ?? table.filters ?? [];
    if (!view.scope) return base;
    const value = scopeValue ?? view.scope.value;
    return {
      ...base,
      mandatory_filter: [
        ...(value ? [{ key: view.scope.key, op: '=', value }] : []),
        ...(base.mandatory_filter ?? []),
      ],
    };
  }, [view, table, filters, scopeValue]);

  if (failed) {
    return (
      <Page>
        <LoadError message="Could not load this page. Check your connection and try again." onRetry={retry} />
      </Page>
    );
  }
  if (!view) return null;

  // Some pages carry figures of their own (who still cannot sign in), which
  // change with the rows.
  const refresh = () => {
    setRefreshKey((key) => key + 1);
    if (view.reload_with_table) reload();
  };

  const open = async (name, row = null) => {
    const spec = view.dialogs[name];
    if (!spec) {
      setImporting(name);
      return;
    }
    // A dialog that edits a record reads it whole first.
    if (spec.load) {
      const load = typeof spec.load === 'string' ? { path: spec.load } : spec.load;
      setLoading(true);
      const res = await customFetch(baseURL + fillFromRow(fillFromPage(load.path, context), row), 'GET', {}, !load.quiet);
      setLoading(false);
      const record = load.pick ? res.response?.[load.pick] : res.response;
      if (!res.success || !record) {
        if (load.failed) toast.error(load.failed);
        return;
      }
      row = record;
    }
    setDialog({ name, row, opened: Date.now() });
  };

  // A value asked for in the browser's own prompt before a request is sent.
  const asked = (prompt, row) => {
    const answer = window.prompt(fillFromRow(prompt.text, row));
    if (answer === null) return null;
    if (prompt.min && answer.length < prompt.min) {
      toast.error(prompt.too_short);
      return null;
    }
    return { [prompt.key]: answer };
  };

  const goTo = (template, row) => navigate(fillFromRow(fillFromPage(template, context), row));

  const runRowAction = async (action, row) => {
    if (action.opens) {
      open(action.opens, row);
      return;
    }
    if (action.navigate) {
      goTo(action.navigate, row);
      return;
    }
    const body = action.prompt ? asked(action.prompt, row) : {};
    if (body === null) return;
    if (await sendRequest(action.request, row, body, setLoading) && !action.request.keeps_rows) refresh();
  };

  const actions = (shownTab || view).actions;
  // A row opens a dialog, a page (unless it lacks what the page needs), or
  // (in_new_tab) the list's own path for it in a new tab.
  const opens = table?.opens;
  const opensRow = opens && !opens.in_new_tab
    ? (row) => {
      if (opens.dialog) open(opens.dialog, row);
      else if (!opens.requires || row[opens.requires]) goTo(opens.navigate, row);
    }
    : undefined;
  if (dialog) lastDialog.current = dialog;
  const shownDialog = dialog || lastDialog.current;
  // Refreshed in place where the search in the table's head must survive a
  // save: remounting the table would empty the box with its search applied.
  const tabKey = shownTab && !table?.keep_on_tab ? `${shownTab.value}-` : '';
  const refreshing = table?.refresh === 'in_place' ? { num: refreshKey } : { key: `${tabKey}${refreshKey}` };

  // A part above the list may show or hide the list's search.
  const searchToggles = (view.above || []).some((part) => part.controls_search);
  // Until toggled, it follows the tab the page opened on, which moving to
  // another tab does not undo.
  const openedOn = view.tabs?.find((each) => each.value === view.tab) || view.tabs?.[0];
  const searchVisible = searchToggles ? searchShown ?? !!openedOn?.shows_search : true;
  const search = { shown: searchVisible, set: setSearchShown };

  const chooseTab = (next) => {
    setTab(next);
    // Each tab's search box unmounts when the other opens, so a search it
    // kept would still filter the list with nothing on screen to say so.
    setFilters(null);
    if (view.tabs.find((each) => each.value === next)?.shows_search) setSearchShown(true);
  };
  const tabs = view.tabs && (
    <Tabs value={shownTab.value} onChange={chooseTab} items={view.tabs.map(({ value, label }) => ({ value, label }))} />
  );

  // A header button opens a dialog or an import, or sends a request (raising
  // a new form), after which the page may be read again whole.
  const press = async (action) => {
    if (!action.request) {
      open(action.opens);
      return;
    }
    const { request } = action;
    const body = Object.fromEntries(Object.entries(request.body || {}).map(([key, value]) => [key, fillFromPage(value, context)]));
    if (await sendRequest({ ...request, path: fillFromPage(request.path, context) }, null, body, setLoading) && request.reload_page) {
      window.location.reload();
    }
  };
  const buttons = (list) => list.map((action) => (
    <CustomButton
      key={action.label}
      text={action.label}
      variant={action.variant}
      disabled={action.disabled}
      onClick={() => press(action)}
    />
  ));
  const Content = view.content ? CONTENT[view.content.block] : null;

  return (
    <Page
      title={view.title}
      description={fillFromPage(view.description, context)}
      tabs={view.tabs_place === 'body' ? undefined : tabs}
      actions={view.scope ? (
        view.scope.options.length > 0 && (
          <div className={view.scope.class_name}>
            <DropdownField
              options={view.scope.options}
              initialValue={scopeValue ?? view.scope.value}
              onChange={setScopeValue}
            />
          </div>
        )
      ) : actions.length === 1 ? buttons(actions)[0] : actions.length > 0 ? <>{buttons(actions)}</> : null}
    >
      {(view.above || []).map((part) => {
        const Above = ABOVE[part.block];
        const props = Object.fromEntries(Object.entries(part.props || {}).map(([key, value]) => [key, fillFromPage(value, context)]));
        return (
          <Above
            key={part.with_rows ? `${part.block}-${refreshKey}` : part.block}
            props={props}
            search={part.controls_search ? search : undefined}
          />
        );
      })}

      {view.tabs_place === 'body' && tabs}

      {Content ? (
        <Content />
      ) : table.kind === 'local' ? (
        <LocalTable table={table} refreshKey={refreshKey} onRowAction={runRowAction} />
      ) : (
        <PagenationTable
          {...refreshing}
          endpoint={fillFromPage(table.endpoint, context)}
          filters={query}
          tableTitle={table.title}
          search={searchVisible && table.search && (
            <FilterBar
              key={table.search.keyed_by_tab ? shownTab?.value : undefined}
              path={table.search.path}
              placeholder={table.search.placeholder}
              exclude={table.search.exclude}
              onSearch={setFilters}
            />
          )}
          extraTopbarComponents={table.toolbar?.length ? <>{buttons(table.toolbar)}</> : null}
          rowClickable={!!opens}
          customOpenForm={opensRow}
          enableApproval={!!table.approval}
          enableSelect={table.select !== false}
          actions={table.actions.map((action) => ({
            icon: <i className={action.icon}></i>,
            tooltip: action.label,
            onClick: (row) => runRowAction(action, row),
          }))}
        />
      )}

      {Object.keys(view.dialogs).length > 0 && (
        <ServerDialog
          dialog={shownDialog ? view.dialogs[shownDialog.name] : null}
          isOpen={!!dialog}
          row={shownDialog?.row ?? null}
          opened={shownDialog?.opened ?? 0}
          onClose={() => setDialog(null)}
          onSaved={refresh}
          onChoose={(name) => open(name, shownDialog?.row ?? null)}
        />
      )}

      {Object.entries(view.imports).map(([name, spec]) => {
        const ImportModal = IMPORTS[spec.kind];
        return (
          <ImportModal
            key={name}
            spec={spec}
            isOpen={importing === name}
            onClose={() => setImporting(null)}
            onImported={refresh}
          />
        );
      })}
    </Page>
  );
};

// Another page is another page: its searches, scope and dialogs start over.
const ServerListPage = ({ page }) => <ServerListPageFor key={page} page={page} />;

export default ServerListPage;
