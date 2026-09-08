import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import Tabs from '../../components/tabs/Tabs';
import CustomModal from '../../components/forms/modal/CustomModal';
import StudentLeave from '../../components/forms/studentLeave/StudentLeave';
import LeaveBalancePanel from './LeaveBalancePanel';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { apiLeaveList, apiLeaveLoad } from '../../api/leave';
import { badgeClass } from '../../data/badges';
import { parseAttendanceQuery, localDateString, overageOf, formatDays } from '../../utils/leaveBalance';
import './AttendancePage.css';

const DAY_PART_LABEL = { full: 'Full day', first_half: 'First half', second_half: 'Second half' };

/**
 * Days a leave excuses, mirroring App\Support\LeaveBalance::daysFor on the
 * server: a half-day costs 0.5 regardless of range, a full-day range costs
 * one day per calendar day inclusive. from/to are already localDateString'd
 * YYYY-MM-DD strings here, not raw API timestamps.
 */
const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((b - a) / 86400000) + 1;
};

/** Rows still waiting on the HOD sort first, then rows pending elsewhere
 * (e.g. bounced back to the scholar), then everything already decided. */
const rowPriority = (row) => {
  if (row.status === 'pending' && row.stage === 'hod') return 0;
  if (row.status === 'pending') return 1;
  return 2;
};

/**
 * The HOD's review of their department's leave applications (spec 5.3).
 * Unlike AttendancePage (a clerk marking many students across departments)
 * or StudentAttendancePage (a scholar's own leaves), this page lists one
 * department's applications and hands the HOD's decision to Recommendation
 * via StudentLeave, rather than building approval controls of its own.
 *
 * A notification links to /attendance?tab=leaves&leave=<id> (see
 * StudentLeaveFormController::formLink) — read with parseAttendanceQuery and
 * opened directly on mount, so the HOD lands on the request itself rather
 * than the list.
 *
 * Recommendation (rendered inside StudentLeave) submits through
 * client-new/src/api/form.js's submitForm, which posts to
 * `baseURL + location.pathname` by default. This page lives at /attendance,
 * not /forms/student-leave/:id, so StudentLeave is given an explicit
 * `submitPath` — threaded down to Recommendation's optional `submitPath`
 * prop — so its Submit button still hits POST /forms/student-leave/:id.
 */
const HodAttendancePage = () => {
  const location = useLocation();
  const opened = useMemo(() => parseAttendanceQuery(location.search), [location.search]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openForm, setOpenForm] = useState(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [balance, setBalance] = useState(null);

  const loadList = useCallback(() => {
    setLoading(true);
    apiLeaveList()
      .then((res) => {
        if (res.success) {
          // listHodForms applies no stage/status filter, so an abandoned draft
          // (created by "Apply for Leave", never submitted) comes back here
          // too — with no from_date, no other field, and nothing for the HOD
          // to act on: handleHodForm 404s on it if opened. A draft is not
          // reviewable by definition, so it has no business in a review
          // queue. Mirrors StudentAttendancePage's own leaveRows filter.
          setRows((res.response?.data || []).filter((r) => r.from_date));
        } else {
          setError('Could not load leave applications. Please try again later.');
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openApplication = useCallback((id) => {
    setLoadingForm(true);
    setBalance(null);
    apiLeaveLoad(id).then((res) => {
      if (res.success) {
        setOpenForm(res.response);
        // GET /forms/student-leave/balance is student-only (403 for an HOD) —
        // it answers "what is MY balance" for whoever is signed in. The
        // scholar's balance as seen by their HOD instead comes from the same
        // clerk-facing endpoint StudentAttendancePage uses for the scholar's
        // own view; an HOD may call it for any student in their own
        // department (see ClerkController::studentAttendance).
        if (res.response?.roll_no) {
          customFetch(`${baseURL}/clerks/attendance/student/${res.response.roll_no}`, 'GET', {}, true)
            .then((r) => { if (r.success) setBalance(r.response.balance); });
        }
      }
    }).finally(() => setLoadingForm(false));
  }, []);

  // Deep link from a notification: open the named application directly
  // rather than leaving the HOD on the list.
  useEffect(() => {
    if (opened.leave) openApplication(opened.leave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened.leave]);

  // Whatever happened inside the modal (approved, rejected, or just closed),
  // the list may now be stale.
  const handleCloseForm = () => {
    setOpenForm(null);
    setBalance(null);
    loadList();
  };

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) => rowPriority(a) - rowPriority(b)),
    [rows]
  );
  const pendingCount = useMemo(() => rows.filter((r) => r.status === 'pending').length, [rows]);

  // Whether the application under review would push the scholar over their
  // quota for that leave type — LeaveBalance::for only counts *approved*
  // leave as used, so this one's own days must be added in before comparing.
  const requestedDays = openForm
    ? (openForm.day_part !== 'full'
        ? 0.5
        : daysBetween(localDateString(openForm.from_date), localDateString(openForm.to_date)))
    : 0;
  const balanceForType = balance && openForm ? balance[openForm.leave_type] : null;
  const overage = balanceForType
    ? overageOf({ quota: balanceForType.quota, used: (Number(balanceForType.used) || 0) + requestedDays })
    : 0;

  return (
    <Layout>
      <h1 className="page-title">Attendance</h1>

      <Tabs
        value="leaves"
        onChange={() => {}}
        items={[{ value: 'leaves', label: 'Leave Requests' }]}
      />

      <div className="filter-bar" style={{ marginTop: '1rem' }}>
        <div className="filter-row" style={{ alignItems: 'center' }}>
          <span>{rows.length} application(s)</span>
          <span className="badge badge--warning">{pendingCount} pending</span>
        </div>
      </div>

      <div className="form-list-container">
        <table className="form-table">
          <thead>
            <tr>
              <th>Scholar</th>
              <th>Roll No</th>
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Part</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="no-data-cell">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={7} className="no-data-cell">{error}</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={7} className="no-data-cell">No leave applications yet.</td></tr>
            ) : sortedRows.map((r) => (
              <tr
                key={r.id}
                onClick={() => openApplication(r.id)}
                className={r.id === opened.leave ? 'leave-row--highlight' : undefined}
                style={{ cursor: 'pointer' }}
              >
                <td>{r.name}</td>
                <td>{r.roll_no}</td>
                <td style={{ textTransform: 'capitalize' }}>{r.leave_type}</td>
                {/* r.from_date/to_date are Laravel date-cast timestamps, not plain
                    YYYY-MM-DD strings — localDateString undoes the UTC-midnight
                    shift APP_TIMEZONE=Asia/Kolkata introduces. */}
                <td>{localDateString(r.from_date)}</td>
                <td>{localDateString(r.to_date)}</td>
                <td>{DAY_PART_LABEL[r.day_part] || r.day_part}</td>
                <td><span className={badgeClass(r.status)}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CustomModal isOpen={!!openForm} onClose={handleCloseForm} width="90vw" minHeight="300px" maxHeight="85vh">
        {openForm && (
          <>
            {loadingForm && <p>Loading…</p>}
            {balance && <LeaveBalancePanel balance={balance} />}
            {overage > 0 && (
              <div className="filter-bar">
                <span className="badge badge--danger">
                  This application is {formatDays(overage)} day(s) over {openForm.name}&rsquo;s {openForm.leave_type} quota
                  — it can still be approved.
                </span>
              </div>
            )}
            {/* See the file-level comment: submitPath tells Recommendation's
                Submit button where to POST since this page isn't mounted at
                /forms/student-leave/:id. */}
            <StudentLeave formData={openForm} submitPath={`/forms/student-leave/${openForm.form_id}`} />
          </>
        )}
      </CustomModal>
    </Layout>
  );
};

export default HodAttendancePage;
