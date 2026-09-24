import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import Page from '../page/Page';
import PagenationTable from '../pagenationTable/PagenationTable';
import FilterBar from '../filterBar/FilterBar';
import CustomButton from '../forms/fields/CustomButton';
import LoadError from '../common/LoadError';
import Tabs from '../tabs/Tabs';
import { useLoading } from '../../context/LoadingContext';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { fillFromRow, useView } from '../../api/views';
import { sendRequest } from './requests';
import ServerDialog from './ServerDialog';
import FileImportModal from './FileImportModal';
import RowsImportModal from './RowsImportModal';
import LocalTable from './LocalTable';

const IMPORTS = { file: FileImportModal, rows: RowsImportModal };

/**
 * A list page as the server describes it (GET /views/{page}, server:
 * App\Pages): the header and its buttons, the table and its row actions, and
 * the dialogs and imports they open. Nothing here knows which page it is.
 */
const ServerListPage = ({ page }) => {
  const { view, failed, retry, reload } = useView(page);
  const navigate = useNavigate();
  const { setLoading } = useLoading();
  // Null until searched: each table starts from the filters its view gives.
  const [filters, setFilters] = useState(null);
  // A page with tabs draws one list at a time; each tab has its own table and buttons.
  const [tab, setTab] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // The dialog open now, the row it was opened on, and which opening it is.
  // One dialog at a time, drawn in one place, so a dialog that hands over to
  // another (a choice) changes in place rather than closing and opening.
  const [dialog, setDialog] = useState(null);
  // The last dialog shown, so it keeps its size while it closes.
  const lastDialog = useRef(null);
  const [importing, setImporting] = useState(null);

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
      setLoading(true);
      const res = await customFetch(baseURL + fillFromRow(spec.load, row), 'GET');
      setLoading(false);
      if (!res.success) return;
      row = res.response;
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

  const runRowAction = async (action, row) => {
    if (action.opens) {
      open(action.opens, row);
      return;
    }
    if (action.navigate) {
      navigate(fillFromRow(action.navigate, row));
      return;
    }
    const body = action.prompt ? asked(action.prompt, row) : {};
    if (body === null) return;
    if (await sendRequest(action.request, row, body, setLoading) && !action.request.keeps_rows) refresh();
  };

  const shownTab = view.tabs ? view.tabs.find((each) => each.value === tab) || view.tabs[0] : null;
  const { table, actions } = shownTab || view;
  // A row opens a dialog, a page, or (in_new_tab) the list's own path for it in a new tab.
  const opensRow = table.opens && !table.opens.in_new_tab
    ? (row) => (table.opens.dialog ? open(table.opens.dialog, row) : navigate(fillFromRow(table.opens.navigate, row)))
    : undefined;
  if (dialog) lastDialog.current = dialog;
  const shownDialog = dialog || lastDialog.current;
  // Refreshed in place where the search in the table's head must survive a
  // save: remounting the table would empty the box with its search applied.
  const tabKey = shownTab ? `${shownTab.value}-` : '';
  const refreshing = table.refresh === 'in_place' ? { num: refreshKey } : { key: `${tabKey}${refreshKey}` };

  return (
    <Page
      title={view.title}
      description={view.description}
      tabs={view.tabs && (
        <Tabs
          value={shownTab.value}
          // Each tab's search box unmounts when the other opens, so a search it
          // kept would still filter the list with nothing on screen to say so.
          onChange={(next) => {
            setTab(next);
            setFilters(null);
          }}
          items={view.tabs.map(({ value, label }) => ({ value, label }))}
        />
      )}
      actions={actions.length > 0 ? (
        <>
          {actions.map((action) => (
            <CustomButton
              key={action.label}
              text={action.label}
              variant={action.variant}
              disabled={action.disabled}
              onClick={() => open(action.opens)}
            />
          ))}
        </>
      ) : null}
    >
      {table.kind === 'local' ? (
        <LocalTable table={table} refreshKey={refreshKey} onRowAction={runRowAction} />
      ) : (
        <PagenationTable
          {...refreshing}
          endpoint={table.endpoint}
          filters={filters ?? table.filters ?? []}
          search={table.search && (
            <FilterBar
              path={table.search.path}
              placeholder={table.search.placeholder}
              exclude={table.search.exclude}
              onSearch={setFilters}
            />
          )}
          rowClickable={!!table.opens}
          customOpenForm={opensRow}
          enableApproval={false}
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

export default ServerListPage;
