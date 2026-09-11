import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
 * Leave applications and the review of one, shared by the HOD and the admin.
 *
 * The server decides whose applications come back: an HOD's own department,
 * or every department for an admin. The decision itself stays with the HOD.
 * An admin opening an application sees the same form, and Recommendation
 * locks it because the viewer is not the role being asked, so there is no
 * Submit for them to press.
 *
 * A notification links to /attendance?tab=leaves&leave=<id> (see
 * StudentLeaveFormController::formLink), read with parseAttendanceQuery and
 * opened directly on mount, so the reader lands on the request itself rather
 * than the list.
 *
 * Recommendation submits through api/form.js's submitForm, which posts to
 * `baseURL + location.pathname` by default. This list lives at /attendance,
 * not /forms/student-leave/:id, so StudentLeave is given an explicit
 * `submitPath` so its Submit button still hits POST /forms/student-leave/:id.
 *
 * @param departmentId  '' for every department the server returned, or one id
 * @param showDepartment  true where the list spans departments
 */
const LeaveRequests = ({ departmentId = '', showDepartment = false }) => {
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
          // The list applies no stage or status filter, so an abandoned draft
          // (created by "Apply for Leave", never submitted) comes back too,
          // with no dates and nothing to review. It has no business in a
          // review queue. Mirrors StudentAttendancePage's own leaveRows filter.
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
        // GET /forms/student-leave/balance answers "what is MY balance" for
        // whoever is signed in, so it refuses anyone but a student. The
        // scholar's balance as seen by a reviewer comes from the clerk-facing
        // endpoint instead, which admits an HOD for their own department and
        // an admin for any (see ClerkController::studentAttendance).
        if (res.response?.roll_no) {
          customFetch(`${baseURL}/clerks/attendance/student/${res.response.roll_no}`, 'GET', {}, true)
            .then((r) => { if (r.success) setBalance(r.response.balance); });
        }
      }
    }).finally(() => setLoadingForm(false));
  }, []);

  // Deep link from a notification: open the named application directly
  // rather than leaving the reader on the list.
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

  const visibleRows = useMemo(
    () => rows
      .filter((r) => !departmentId || String(r.department_id) === String(departmentId))
      .sort((a, b) => rowPriority(a) - rowPriority(b)),
    [rows, departmentId]
  );
  const pendingCount = useMemo(() => visibleRows.filter((r) => r.status === 'pending').length, [visibleRows]);
  const columnCount = showDepartment ? 8 : 7;

  // Whether the application under review would push the scholar over their
  // quota for that leave type. LeaveBalance::for only counts *approved* leave
  // as used, so this one's own days must be added in before comparing.
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
    <>
      <div className="filter-bar" style={{ marginTop: '1rem' }}>
        <div className="filter-row" style={{ alignItems: 'center' }}>
          <span>{visibleRows.length} application(s)</span>
          <span className="badge badge--warning">{pendingCount} pending</span>
        </div>
      </div>

      <div className="form-list-container">
        <table className="form-table">
          <thead>
            <tr>
              <th>Scholar</th>
              <th>Roll No</th>
              {showDepartment && <th>Department</th>}
              <th>Type</th>
              <th>From</th>
              <th>To</th>
              <th>Part</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columnCount} className="no-data-cell">Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={columnCount} className="no-data-cell">{error}</td></tr>
            ) : visibleRows.length === 0 ? (
              <tr><td colSpan={columnCount} className="no-data-cell">No leave applications yet.</td></tr>
            ) : visibleRows.map((r) => (
              <tr
                key={r.id}
                onClick={() => openApplication(r.id)}
                className={r.id === opened.leave ? 'leave-row--highlight' : undefined}
                style={{ cursor: 'pointer' }}
              >
                <td>{r.name}</td>
                <td>{r.roll_no}</td>
                {showDepartment && <td>{r.department}</td>}
                <td style={{ textTransform: 'capitalize' }}>{r.leave_type}</td>
                {/* r.from_date/to_date are Laravel date-cast timestamps, not plain
                    YYYY-MM-DD strings. localDateString undoes the UTC-midnight
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
                  This application is {formatDays(overage)} day(s) over {openForm.name}&rsquo;s {openForm.leave_type} quota,
                  but it can still be approved.
                </span>
              </div>
            )}
            <StudentLeave formData={openForm} submitPath={`/forms/student-leave/${openForm.form_id}`} />
          </>
        )}
      </CustomModal>
    </>
  );
};

export default LeaveRequests;
