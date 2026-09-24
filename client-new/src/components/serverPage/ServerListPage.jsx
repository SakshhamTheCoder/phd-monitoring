import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Page from '../page/Page';
import PagenationTable from '../pagenationTable/PagenationTable';
import FilterBar from '../filterBar/FilterBar';
import CustomButton from '../forms/fields/CustomButton';
import LoadError from '../common/LoadError';
import { useLoading } from '../../context/LoadingContext';
import { fillFromRow, useView } from '../../api/views';
import { sendRequest } from './requests';
import ServerDialog from './ServerDialog';
import FileImportModal from './FileImportModal';
import RowsImportModal from './RowsImportModal';

const IMPORTS = { file: FileImportModal, rows: RowsImportModal };

/**
 * A list page as the server describes it (GET /views/{page}, server:
 * App\Pages): the header and its buttons, the table and its row actions, and
 * the dialogs and imports they open. Nothing here knows which page it is.
 */
const ServerListPage = ({ page }) => {
  const { view, failed, retry } = useView(page);
  const navigate = useNavigate();
  const { setLoading } = useLoading();
  const [filters, setFilters] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);
  // The dialog open now, the row it was opened on, and which opening it is.
  const [dialog, setDialog] = useState(null);
  const [importing, setImporting] = useState(null);

  if (failed) {
    return (
      <Page>
        <LoadError message="Could not load this page. Check your connection and try again." onRetry={retry} />
      </Page>
    );
  }
  if (!view) return null;

  const refresh = () => setRefreshKey((key) => key + 1);
  const open = (name, row = null) => {
    if (view.dialogs[name]) setDialog({ name, row, opened: Date.now() });
    else setImporting(name);
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
    if (await sendRequest(action.request, row, {}, setLoading)) refresh();
  };

  const { table } = view;
  const opensRow = (row) => (table.opens.dialog ? open(table.opens.dialog, row) : navigate(fillFromRow(table.opens.navigate, row)));

  return (
    <Page
      title={view.title}
      description={view.description}
      actions={view.actions.length > 0 ? (
        <>
          {view.actions.map((action) => (
            <CustomButton key={action.label} text={action.label} variant={action.variant} onClick={() => open(action.opens)} />
          ))}
        </>
      ) : null}
    >
      <PagenationTable
        key={refreshKey}
        endpoint={table.endpoint}
        filters={filters}
        search={table.search && (
          <FilterBar
            path={table.search.path}
            placeholder={table.search.placeholder}
            exclude={table.search.exclude}
            onSearch={setFilters}
          />
        )}
        rowClickable={!!table.opens}
        customOpenForm={table.opens ? opensRow : undefined}
        enableApproval={false}
        actions={table.actions.map((action) => ({
          icon: <i className={action.icon}></i>,
          tooltip: action.label,
          onClick: (row) => runRowAction(action, row),
        }))}
      />

      {Object.entries(view.dialogs).map(([name, spec]) => (
        <ServerDialog
          key={name}
          dialog={spec}
          isOpen={dialog?.name === name}
          row={dialog?.name === name ? dialog.row : null}
          opened={dialog?.name === name ? dialog.opened : 0}
          onClose={() => setDialog(null)}
          onSaved={refresh}
        />
      ))}

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
