import React, { useEffect, useState, useMemo } from 'react';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import FilterBar from '../../components/filterBar/FilterBar';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { apiDepartmentList } from '../../api/lookups';
import { EMPTY_VALUE } from '../../utils/timeParse';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import ClerkForm from '../../components/clerkForm/ClerkForm';
import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
import { useRowMenu } from '../../hooks/useRowMenu';
import LoadError from '../../components/common/LoadError';
import './ClerkManagement.css';

/**
 * Admin, clerk management. The clerks endpoint is small and not paginated, so
 * the list is drawn here and the FilterBar filters it on the client.
 */
const ClerkManagement = () => {
  const [clerks, setClerks] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filter, setFilter] = useState({ conditions: [] });
  const [loading, setLoading] = useState(true);
  // A failed load is not "no clerks yet".
  const [loadFailed, setLoadFailed] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkUpdateOpen, setIsBulkUpdateOpen] = useState(false);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const { openMenu, menuStyle, toggleMenu, closeMenu } = useRowMenu();

  const clerkSampleCsv = `email,phone,department_codes,full_name
clerk.one@demo.invalid,9800000031,"CSED, CHED",Anita Desai`;

  const loadClerks = async () => {
    setLoading(true);
    const res = await customFetch(baseURL + '/clerks', 'GET', {}, true);
    setLoading(false);
    setLoadFailed(!res.success);
    if (res.success) setClerks(res.response.data || []);
  };

  useEffect(() => {
    loadClerks();
    apiDepartmentList().then((res) => {
      if (res.success) setDepartments(res.response.data || []);
    });
  }, []);

  const openEditor = (clerk) => {
    setEditing(clerk);
    setSelectedDeptIds(clerk.departments.map((d) => d.department_id));
  };

  const toggleDepartment = (deptId) => {
    setSelectedDeptIds((prev) =>
      prev.includes(deptId) ? prev.filter((id) => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    const res = await customFetch(
      baseURL + `/clerks/${editing.id}/departments`,
      'POST',
      { department_ids: selectedDeptIds },
      true
    );
    setSaving(false);
    if (res.success) {
      toast.success(res.response.message || 'Departments updated.');
      setEditing(null);
      loadClerks();
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter || { conditions: [] });
  };

  const handleBulkUpdate = async (csvPreview, resetState) => {
    try {
      setBulkSubmitting(true);

      const BATCH_SIZE = 50;
      const totalRows = csvPreview.data.length;
      const batches = [];
      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        batches.push(csvPreview.data.slice(i, i + BATCH_SIZE));
      }

      let totalSuccess = 0;
      let totalUpdated = 0;
      let totalErrors = 0;
      let allErrors = [];

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        setUploadProgress({
          current: (batchIndex + 1) * BATCH_SIZE > totalRows ? totalRows : (batchIndex + 1) * BATCH_SIZE,
          total: totalRows,
          percentage: Math.round(((batchIndex + 1) / batches.length) * 100)
        });

        const clerkRows = batch.map(r => ({
          email: r.email,
          phone: r.phone,
          full_name: r.full_name || [r.first_name, r.last_name].filter(Boolean).join(' ') || '',
          department_codes: r.department_codes,
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          const res = await customFetch(baseURL + '/clerks/bulk-update', 'POST', { clerks: clerkRows }, true);
          if (res.success) {
            const d = res.response.data || {};
            totalSuccess += d.success_count ?? 0;
            totalUpdated += d.update_count ?? res.response.successful ?? 0;
            totalErrors += d.error_count ?? res.response.failed ?? 0;
            allErrors = allErrors.concat(d.errors || res.response.errors || []);
            batchSuccess = true;
          } else if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            toast.error(`Batch ${batchIndex + 1} failed.`);
            totalErrors += batch.length;
          }
        }
      }

      const summary = `${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors.`;
      if (totalSuccess + totalUpdated > 0) toast.success(`Import completed: ${summary}`);
      else toast.error(`Nothing was imported: ${summary}`);
      if (allErrors.length > 0) {
        const more = allErrors.length > 3 ? `; and ${allErrors.length - 3} more` : '';
        toast.warning(`Check these rows: ${allErrors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
      }

      setIsBulkUpdateOpen(false);
      resetState?.();
      setUploadProgress(null);
      loadClerks();
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import CSV.');
    } finally {
      setBulkSubmitting(false);
      setUploadProgress(null);
    }
  };

  // Client-side filter — the clerk list is small and unpaginated, so it is
  // matched here rather than in a query. The rules are the server's: a field
  // given two values widens (either matches), two fields narrow each other, and
  // the search box sends one value across every field at once, which is an OR.
  const filteredClerks = useMemo(() => {
    const conditions = filter.conditions || [];
    const mandatory = filter.mandatory_filter || [];

    if (conditions.length === 0 && mandatory.length === 0) return clerks;

    // A clerk can be tagged with several departments, so a field is a list and
    // any one of its values matching is a match.
    const valuesOf = (clerk, key) => (key === 'department.name'
      ? clerk.departments.map((d) => d.name ?? '')
      : [clerk[key] ?? '']);

    const matches = (clerk, condition) => {
      const wanted = String(condition.value ?? '').toLowerCase();
      if (!wanted) return true;

      return valuesOf(clerk, condition.key).some((held) => {
        const value = String(held).toLowerCase();
        return condition.op === '=' ? value === wanted : value.includes(wanted);
      });
    };

    const groupedByKey = (list) => Object.values(list.reduce((all, condition) => {
      (all[condition.key] = all[condition.key] || []).push(condition);
      return all;
    }, {}));

    return clerks.filter((clerk) => {
      if (!mandatory.every((condition) => matches(clerk, condition))) return false;
      if (conditions.length === 0) return true;

      return filter.combine === 'or'
        ? conditions.some((condition) => matches(clerk, condition))
        : groupedByKey(conditions).every((group) => group.some((condition) => matches(clerk, condition)));
    });
  }, [clerks, filter]);

  const closeCreate = (saved = false) => {
    setIsCreateOpen(false);
    if (saved) loadClerks();
  };

  return (
    <Page
      title="Clerk management"
      description="Create clerk logins and tag them with the departments whose PhD attendance they mark."
      actions={<>
        <CustomButton text="Import from CSV" variant="secondary" onClick={() => setIsBulkUpdateOpen(true)} />
        <CustomButton text="Add clerk" onClick={() => setIsCreateOpen(true)} />
      </>}
    >
      <Panel flush>
        {/* Drawn as the head PagenationTable gives its search, so this hand
            drawn list reads the same as the server paged ones. */}
        <div className="panel-head">
          <div className="table-search clerk-search">
            {/* The page answers to two addresses; the filters live at one of them. */}
            <FilterBar path="/clerks" onSearch={handleFilterChange} />
          </div>
        </div>

        {loading ? (
          <div className="clerk-state"><StatusNotice tone="loading" title="Loading clerks" /></div>
        ) : loadFailed ? (
          <div className="clerk-state">
            <LoadError message="Could not load the clerks. Check your connection and try again." onRetry={loadClerks} />
          </div>
        ) : filteredClerks.length === 0 ? (
          <div className="clerk-state">
            <StatusNotice tone="empty">
              {clerks.length === 0
                ? 'No clerk accounts yet. Use Add clerk to create the first one.'
                : 'No clerks match the current filters.'}
            </StatusNotice>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Departments</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredClerks.map((clerk, idx) => (
                  <tr key={clerk.id} className="form-row">
                    <td>{idx + 1}</td>
                    <td>{clerk.name}</td>
                    <td>{clerk.email}</td>
                    <td>
                      {clerk.departments.length === 0 ? (
                        <span className="clerk-none">{EMPTY_VALUE}</span>
                      ) : (
                        clerk.departments.map((d) => d.name).join(', ')
                      )}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="row-actions-trigger"
                          title="Actions"
                          aria-expanded={openMenu === idx}
                          onClick={(e) => toggleMenu(idx, e)}
                        >
                          <i className="fa fa-ellipsis-v"></i>
                        </button>
                        {openMenu === idx && (
                          <div className="row-actions-menu" style={menuStyle} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="row-actions-item"
                              onClick={(e) => {
                                e.stopPropagation();
                                closeMenu();
                                openEditor(clerk);
                              }}
                            >
                              <span className="ra-icon">
                                <i className="fa fa-users"></i>
                              </span>
                              <span>Manage departments</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <CustomModal
        isOpen={isCreateOpen}
        onClose={() => closeCreate(false)}
        closeOnOutsideClick={false}
        width="80vw"
      >
        <ClerkForm
          onSuccess={() => closeCreate(true)}
          onClose={() => closeCreate(true)}
        />
      </CustomModal>

      <CustomModal
        isOpen={!!editing}
        onClose={() => setEditing(null)}
        closeOnOutsideClick={false}
        title={`Departments for ${editing?.name || ''}`}
        width="560px"
      >
        <p className="modal-note">
          Select every department this clerk marks attendance for. Saved departments are the only ones whose scholars appear on the clerk&apos;s attendance roster.
        </p>
        <div className="clerk-dept-grid">
          {departments.length === 0 ? (
            <span className="clerk-none">No departments yet.</span>
          ) : (
            departments.map((d) => {
              const selected = selectedDeptIds.includes(d.id);
              return (
                <label key={d.id} className={`clerk-dept${selected ? ' is-chosen' : ''}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleDepartment(d.id)}
                  />
                  <span>
                    {d.name} {d.code ? `(${d.code})` : ''}
                  </span>
                </label>
              );
            })
          )}
        </div>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={() => setEditing(null)} />
          <CustomButton text={saving ? 'Saving…' : 'Save'} onClick={handleSave} disabled={saving} />
        </div>
      </CustomModal>

      <UnifiedBulkImportModal
        isOpen={isBulkUpdateOpen}
        onClose={() => setIsBulkUpdateOpen(false)}
        title="Import clerks from CSV"
        required={['email']}
        rules={[
              'Matched by email. A clerk is created when the email is not found.',
              'department_codes is a comma separated list, for example "CSED, CHED".',
              'A blank department_codes leaves the clerk\'s current departments alone.',
            ]}
        sampleFileName="clerk_bulk_import_sample.csv"
        sampleCsvContent={clerkSampleCsv}
        onImport={handleBulkUpdate}
        submitting={bulkSubmitting}
        uploadProgress={uploadProgress}
      />
    </Page>
  );
};

export default ClerkManagement;
