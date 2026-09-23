import React, { useEffect, useState } from 'react';
import Page from '../../components/page/Page';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import FilterBar from '../../components/filterBar/FilterBar';
import PagenationTable from '../../components/pagenationTable/PagenationTable';
import CustomModal from '../../components/forms/modal/CustomModal';
import UserForm from '../../components/userForm/UserForm';
import NewUserKindPicker from '../../components/userForm/NewUserKindPicker';
import StudentForm from '../../components/studentForm/StudentForm';
import FacultyForm from '../../components/facultyForm/FacultyForm';
import ClerkForm from '../../components/clerkForm/ClerkForm';
import { baseURL } from '../../api/urls';
import CustomButton from '../../components/forms/fields/CustomButton';
import { customFetch, NETWORK_ERROR_MESSAGE } from '../../api/base';

import { formatDate } from '../../utils/timeParse';
import UnifiedBulkImportModal from '../../components/bulkImport/UnifiedBulkImportModal';
import useCapabilities from '../../context/CapabilitiesContext';

const UsersPage = () => {
  const [filter, setFilter] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Which creation flow the admin picked: null (picker showing), 'student',
  // 'faculty' or 'other'. Only used when creating, editing goes straight to
  // UserForm as before.
  const [createKind, setCreateKind] = useState(null);
  const { setLoading } = useLoading();
  const location = useLocation();
  const can = useCapabilities();
  const managesUsers = can('can_manage_users');

  // Accounts nobody has claimed: an import creates them without mailing
  // anybody, and the office sends the links once those people have been told
  // the portal exists. Each import run stays on the list until its last
  // person is in, so a second import never buries the first.
  const [pending, setPending] = useState(null);
  const [linksOpen, setLinksOpen] = useState(false);
  const [chosenRun, setChosenRun] = useState('everyone');
  const [sendingLinks, setSendingLinks] = useState(false);

  const readPending = () => {
    if (!managesUsers) return;
    customFetch(`${baseURL}/users/sign-in-links`, 'GET', {}, false)
      .then((res) => setPending(res?.response ?? null))
      .catch(() => {});
  };

  // Capabilities arrive from their own request, so a page reloaded on /users
  // has none on the first render. Without it in the dependencies this asked
  // once, too early, and the button sat empty.
  useEffect(readPending, [refreshKey, managesUsers]);

  const runs = pending?.runs ?? [];
  const waitingEveryone = pending?.everyone?.count ?? 0;
  // "756 student, 15 clerk" rather than a bare 771, because everyone reaches
  // the accounts other imports created too.
  const waitingByRole = Object.entries(pending?.everyone?.by_role ?? {})
    .map(([role, count]) => `${count} ${role.replace(/_/g, ' ')}`)
    .join(', ');

  const sendSignInLinks = async () => {
    setSendingLinks(true);
    const body = chosenRun === 'everyone' ? {} : { batch: chosenRun };
    const res = await customFetch(`${baseURL}/users/sign-in-links`, 'POST', body);
    setSendingLinks(false);

    if (res?.success) {
      toast.success(res.response.message);
      setLinksOpen(false);
      readPending();
    }
  };

  const handleFilterChange = (newFilter) => {
    setFilter(newFilter);
  };

  const usersSampleCsv = `full_name,email,phone,gender,role,available_roles,status
Khalid Bashir,khalid.bashir.user@demo.invalid,9800000021,male,faculty,"faculty,doctoral",active`;

  const openForm = async (data) => {
    if (data) {
      setLoading(true);
      // customFetch has already toasted the reason when this fails.
      const res = await customFetch(baseURL + `/users/${data.id}`, 'GET');
      setLoading(false);
      if (res.success) {
        setEditData(res.response);
        setIsOpen(true);
      }
    } else {
      // Creating: start at the kind picker rather than the bare user form, so
      // the student/faculty record gets created alongside the login.
      setEditData(null);
      setCreateKind(null);
      setIsOpen(true);
    }
  };

  // `saved` distinguishes a successful save from a dismissal. Re-keying the
  // table refetches it, so doing that on every close made cancelling or hitting
  // the X reload the whole list for nothing.
  const closeUserModal = (saved = false) => {
    setIsOpen(false);
    setEditData(null);
    setCreateKind(null);
    if (saved) {
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleDeleteUser = async (userData) => {
    if (!window.confirm(`Are you sure you want to delete ${userData.name || 'this user'}? This action cannot be undone.`)) {
      return;
    }

    const result = await customFetch(baseURL + `/users/${userData.id}`, 'DELETE', {}, true);
    if (result.success) {
      setRefreshKey(prev => prev + 1);
    }
  };

  const handleResetPassword = async (userData) => {
    const newPassword = window.prompt(`Enter a new password for ${userData.name || 'this user'} (min 8 characters):`);
    if (newPassword === null) {
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    await customFetch(
      baseURL + `/users/${userData.id}/reset-password`,
      'POST',
      { password: newPassword },
      true
    );
  };

  const handleBulkImport = async (csvPreview, resetState) => {
    try {
      setSubmitting(true);
      setLoading(true);
      
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

      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please login again.');
        setLoading(false);
        setSubmitting(false);
        return;
      }

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        setUploadProgress({
          current: (batchIndex + 1) * BATCH_SIZE > totalRows ? totalRows : (batchIndex + 1) * BATCH_SIZE,
          total: totalRows,
          percentage: Math.round(((batchIndex + 1) / batches.length) * 100)
        });

        const batchData = batch.map(row => ({
          full_name: row.full_name || [row.first_name, row.last_name].filter(Boolean).join(' ') || '',
          email: row.email || '',
          phone: row.phone || '',
          gender: row.gender || '',
          role: row.role || '',
          available_roles: row.available_roles || '',
          status: row.status || 'active',
          row_number: row._rowNumber
        }));

        let retryCount = 0;
        const maxRetries = 2;
        let batchSuccess = false;

        while (retryCount <= maxRetries && !batchSuccess) {
          // Quiet, so a failed batch is reported once below rather than once
          // per attempt. A 401 still sends customFetch to the sign-in page,
          // after it clears the session, and there is no point going on.
          const res = await customFetch(`${baseURL}/users/bulk-import`, 'POST', { batch_data: batchData }, false);
          if (!res.success && !localStorage.getItem('token')) return;

          const data = res.response || {};
          if (res.success && data.success) {
            totalSuccess += data.data?.success_count || 0;
            totalUpdated += data.data?.update_count || 0;
            totalErrors += data.data?.error_count || 0;
            allErrors = allErrors.concat(data.data?.errors || []);
            batchSuccess = true;
          } else if (retryCount < maxRetries) {
            retryCount++;
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            toast.error(res.networkError
              ? NETWORK_ERROR_MESSAGE
              : `Batch ${batchIndex + 1} failed: ${data.message || 'Server error'}`);
            totalErrors += batch.length;
            break;
          }
        }
      }

      const summary = `${totalSuccess} created, ${totalUpdated} updated, ${totalErrors} errors`;
      if (totalSuccess + totalUpdated > 0) toast.success(`Import completed: ${summary}`);
      else toast.error(`Nothing was imported: ${summary}`);

      if (allErrors.length > 0) {
        const more = allErrors.length > 3 ? `; and ${allErrors.length - 3} more` : '';
        toast.warning(`Check these rows: ${allErrors.slice(0, 3).join('; ')}${more}`, { autoClose: 10000 });
      }

      setShowBulkImportModal(false);
      resetState?.();
      setUploadProgress(null);
      setRefreshKey(prev => prev + 1);
      
    } catch (error) {
      console.error('Error importing CSV:', error);
      toast.error('Failed to import CSV');
    } finally {
      setLoading(false);
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <Page
      title="Manage users"
      description="Create accounts and assign roles."
      actions={managesUsers ? (
        <>
          <CustomButton
            text={waitingEveryone ? `Send sign-in links (${waitingEveryone})` : 'Send sign-in links'}
            variant="quiet"
            disabled={!waitingEveryone}
            onClick={() => { setChosenRun(runs[0]?.batch ?? 'everyone'); setLinksOpen(true); }}
          />
          <CustomButton
            text="Import from CSV"
            variant="secondary"
            onClick={() => setShowBulkImportModal(true)}
          />
          <CustomButton text="Add user" onClick={() => openForm()} />
        </>
      ) : null}
    >
      {/* Refreshed through `num`, not a key: a key would remount the table
          and with it the FilterBar in its head, clearing the search box while
          the search itself stayed applied. */}
      <PagenationTable
        num={refreshKey}
        endpoint={location.pathname}
        filters={filter}
        search={<FilterBar onSearch={handleFilterChange} />}
        enableApproval={false}
        // The row is a way into the edit form, so it follows the same
        // capability as the Edit action rather than the route alone.
        rowClickable={can('can_manage_users')}
        customOpenForm={openForm}
        actions={can('can_manage_users') ? [
          {
            icon: <i className="fa fa-pencil-square-o"></i>,
            tooltip: 'Edit',
            onClick: (userData) => openForm(userData),
          },
          {
            icon: <i className="fa fa-key"></i>,
            tooltip: 'Reset password',
            onClick: (userData) => handleResetPassword(userData),
          },
          {
            icon: <i className="fa fa-trash"></i>,
            tooltip: 'Delete',
            onClick: (userData) => handleDeleteUser(userData),
          },
        ] : []}
      />
      <CustomModal
        isOpen={isOpen}
        onClose={() => closeUserModal(false)}
        closeOnOutsideClick={false}
        width={createKind === null && !editData ? '520px' : '80vw'}
      >
        {/* These forms only invoke onSuccess/onClose after a save completes,
            so those close with saved=true. The modal's own X and the picker's
            Cancel are dismissals and close without refetching. */}
        {editData ? (
          // Editing an existing user is unchanged, since the record already
          // exists there is nothing to pick.
          <UserForm edit={true} userData={editData} onClose={() => closeUserModal(true)} />
        ) : createKind === null ? (
          <NewUserKindPicker onSelect={setCreateKind} onCancel={() => closeUserModal(false)} />
        ) : createKind === 'student' ? (
          // Creates the User and Student record in one call.
          <StudentForm onSuccess={() => closeUserModal(true)} onClose={() => closeUserModal(true)} />
        ) : createKind === 'faculty' ? (
          // Creates the User and Faculty record in one call.
          // FacultyForm calls both onSuccess and onClose after a save, so only
          // one of them may refetch.
          <FacultyForm onSuccess={() => closeUserModal(true)} />
        ) : createKind === 'clerk' ? (
          <ClerkForm onSuccess={() => closeUserModal(true)} onClose={() => closeUserModal(true)} />
        ) : (
          <UserForm edit={false} userData={null} onClose={() => closeUserModal(true)} />
        )}
      </CustomModal>

      <CustomModal isOpen={linksOpen} onClose={() => setLinksOpen(false)} title="Send sign-in links">
        <div className="modal-form">
          <p>
            A link lets somebody choose their password. Anybody who already signs in,
            with a password or through Google, is left out.
          </p>

          {runs.map((run) => (
            <label key={run.batch} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
              <input
                type="radio"
                name="sign-in-link-group"
                value={run.batch}
                checked={chosenRun === run.batch}
                onChange={() => setChosenRun(run.batch)}
              />
              <span>
                <strong>{run.of === 'staff' ? 'Staff' : 'Scholars'} imported {formatDate(run.imported_at)}</strong>
                {' '}({run.waiting} waiting)
              </span>
            </label>
          ))}

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
            <input
              type="radio"
              name="sign-in-link-group"
              value="everyone"
              checked={chosenRun === 'everyone'}
              onChange={() => setChosenRun('everyone')}
            />
            <span>
              <strong>Everyone who cannot sign in yet ({waitingEveryone})</strong>
              {waitingByRole && <>: {waitingByRole}</>}
            </span>
          </label>

          <div className="modal-actions">
            <CustomButton text="Cancel" variant="quiet" onClick={() => setLinksOpen(false)} />
            <CustomButton
              text={sendingLinks ? 'Sending...' : 'Send links'}
              disabled={sendingLinks || !waitingEveryone}
              onClick={sendSignInLinks}
            />
          </div>
        </div>
      </CustomModal>

      {/* Bulk Import Modal */}
      <UnifiedBulkImportModal
        isOpen={showBulkImportModal}
        onClose={() => setShowBulkImportModal(false)}
        title="Import users from CSV"
        required={['full_name', 'email', 'role']}
        rules={[
          'Matched by email. An existing user is updated from the cells the row fills in.',
          'gender is male, female or other. status is active, inactive or suspended.',
          'available_roles is a comma separated list.',
        ]}
        sampleFileName="users_bulk_import_sample.csv"
        sampleCsvContent={usersSampleCsv}
        onImport={handleBulkImport}
        submitting={submitting}
        uploadProgress={uploadProgress}
      />
    </Page>
  );
};

export default UsersPage;
