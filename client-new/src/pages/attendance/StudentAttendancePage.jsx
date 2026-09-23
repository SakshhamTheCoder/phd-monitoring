import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import Tabs from '../../components/tabs/Tabs';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import StudentLeave from '../../components/forms/studentLeave/StudentLeave';
import LeaveBalancePanel from './LeaveBalancePanel';
import AttendanceSummary from './AttendanceSummary';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { apiLeaveCreate, apiLeaveLoad, apiLeaveDelete } from '../../api/leave';
import { badgeClass } from '../../data/badges';
import { parseAttendanceQuery, localDateString, localMonthKey } from '../../utils/leaveBalance';
import { EMPTY_VALUE } from '../../utils/timeParse';
import './AttendancePage.css';

const DAY_PART_LABEL = { full: 'Full day', first_half: 'First half', second_half: 'Second half' };

/**
 * A scholar's own attendance: Monthly and Sessions here, Leaves in Task 11.
 * Unlike AttendancePage (a clerk marking many students across departments),
 * this page has exactly one student: the signed-in scholar.
 */
const StudentAttendancePage = () => {
  const location = useLocation();
  const opened = useMemo(() => parseAttendanceQuery(location.search), [location.search]);
  const [activeTab, setActiveTab] = useState(opened.tab === 'leaves' ? 'leaves' : 'monthly');
  const [data, setData] = useState(null);
  // Starts true: there is always at least the roll-number lookup in flight
  // between mount and the first render, and the tables must not read as
  // "no records" during that window.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [rollNo, setRollNo] = useState(null);
  const [openForm, setOpenForm] = useState(null); // full fullForm() json, or null
  const [applying, setApplying] = useState(false);
  const highlightRef = useRef(null);

  // localStorage holds no roll_no for a scholar. GET /students/me answers with
  // the caller's own record, the same endpoint ProfileCard reads.
  useEffect(() => {
    customFetch(`${baseURL}/students/me`, 'GET', {}, true, false).then((res) => {
      const rn = res?.success ? res.response.profile?.roll_no ?? null : null;
      if (rn) {
        setRollNo(rn);
      } else {
        // Nothing will fetch attendance without a roll_no, so this is a dead
        // end, not just "still loading" — say so rather than falling through
        // to an empty-records table.
        setError('Could not load your student record. Please try again later.');
        setLoading(false);
      }
    });
  }, []);

  const loadData = useCallback(() => {
    if (!rollNo) return;
    setLoading(true);
    customFetch(`${baseURL}/clerks/attendance/student/${rollNo}`, 'GET', {}, true)
      .then((res) => {
        if (res?.success) {
          setData(res.response);
          setError(null);
        } else setError('Could not load your attendance records. Please try again later.');
      })
      .finally(() => setLoading(false));
  }, [rollNo]);

  useEffect(() => { loadData(); }, [loadData]);

  // Scroll the row a notification link named (?tab=leaves&leave=42) into view
  // once the leaves have actually loaded — the ref only attaches once that
  // row exists in the DOM.
  useEffect(() => {
    if (opened.leave && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [opened.leave, data]);

  // Reuse an already-open draft rather than minting another: apiLeaveCreate
  // persists a row immediately, and a scholar re-clicking Apply (or clicking
  // it, cancelling, and clicking it again) must not accumulate blank drafts.
  const handleApply = async () => {
    setApplying(true);
    const existingDraft = (data?.leaves || []).find((l) => l.status === 'draft');
    let formId = existingDraft?.id;
    if (!formId) {
      const created = await apiLeaveCreate();
      if (!created.success) { setApplying(false); return; }
      formId = created.response.id;
    }
    const loaded = await apiLeaveLoad(formId);
    if (loaded.success) setOpenForm(loaded.response);
    setApplying(false);
  };

  // Whatever happened inside the modal (submitted or just closed), the
  // balance/leaves list may now be stale — refresh on close rather than
  // threading a callback through StudentLeave/Student.
  const handleCloseForm = () => {
    setOpenForm(null);
    loadData();
  };

  // Monthly: group the scholar's own records by local YYYY-MM and count each
  // bucket. Records come back date-cast by Laravel under APP_TIMEZONE=Asia/Kolkata,
  // so a record stored as "2024-05-01" serializes as "2024-04-30T18:30:00.000000Z" —
  // localMonthKey (see client-new/src/utils/leaveBalance.js) undoes that shift
  // instead of slicing the raw string, which would file it under April.
  const months = useMemo(() => {
    const out = {};
    for (const r of (data?.records || [])) {
      const key = localMonthKey(r.date);
      out[key] ??= { month: key, present: 0, absent: 0, total: 0 };
      if (r.status === 'present' || r.status === 'absent') out[key][r.status] += 1;
      out[key].total += 1;
    }
    return Object.values(out).sort((a, b) => b.month.localeCompare(a.month));
  }, [data]);

  const records = data?.records || [];
  const leaveRows = data?.leaves || [];

  // Any application can be opened: a draft to finish it, a decided one to read
  // the HOD's remarks.
  const openLeave = async (id) => {
    const loaded = await apiLeaveLoad(id);
    if (loaded.success) setOpenForm(loaded.response);
  };

  // Opening an application and thinking better of it should not leave a row
  // behind. Only a draft can go; once the HOD has it, it is a record.
  const deleteDraft = async (id) => {
    if (!window.confirm('Delete this draft application?')) return;
    const res = await apiLeaveDelete(id);
    if (res.success) loadData();
  };

  return (
    <Page
      title="My attendance"
      actions={
        <CustomButton
          text="Apply for leave"
          onClick={handleApply}
          busy={applying}
          // Until the leaves have loaded, an existing draft cannot be found
          // and a quick click would create a second one.
          disabled={!data}
        />
      }
      tabs={
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'sessions', label: 'Sessions' },
            { value: 'leaves', label: 'Leaves' },
          ]}
        />
      }
    >
      {data && (
        <AttendanceSummary
          title="Summary"
          caption={`${data.current_month?.label ? `${data.current_month.label} · ` : ''}All-time figures for ${data.student?.name || 'you'}`}
          stats={[
            { label: 'Sessions', value: data.summary.total },
            { label: 'Present', tone: 'present', value: data.summary.present },
            { label: 'Absent', tone: 'absent', value: data.summary.absent },
            { label: 'Attendance', value: data.summary.percent != null ? `${data.summary.percent}%` : EMPTY_VALUE },
          ]}
        />
      )}

      {activeTab === 'monthly' && (
        <Panel flush title="By month">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Month</th><th>Present</th><th>Absent</th><th>Sessions</th><th>Attendance %</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="no-data-cell">Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan={5} className="no-data-cell">{error}</td></tr>
                ) : months.length === 0 ? (
                  <tr><td colSpan={5} className="no-data-cell">No attendance recorded yet.</td></tr>
                ) : months.map((m) => (
                  <tr key={m.month}>
                    <td>{m.month}</td>
                    <td className="attendance-status-present">{m.present}</td>
                    <td className="attendance-status-absent">{m.absent}</td>
                    <td>{m.total}</td>
                    {/* A bucket only exists here when a record created it, so m.total is
                        always >= 1; unlike the backend's AttendanceSummary (which can see
                        a genuinely zero-session set and prints '-' for it), there is no
                        zero-session case to guard against on this table. */}
                    <td>{Math.round((m.present / m.total) * 100)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === 'sessions' && (
        <Panel flush title="Sessions">
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Session</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={3} className="no-data-cell">Loading…</td></tr>
                ) : error ? (
                  <tr><td colSpan={3} className="no-data-cell">{error}</td></tr>
                ) : records.length === 0 ? (
                  <tr><td colSpan={3} className="no-data-cell">No sessions recorded yet.</td></tr>
                ) : records.map((r) => (
                  <tr key={`${r.date}-${r.lecture_id}`}>
                    {/* localDateString undoes the same UTC-midnight shift as localMonthKey
                        above: r.date is not a plain YYYY-MM-DD string, it's a Laravel
                        date-cast timestamp (see the comment on the months useMemo). */}
                    <td>{localDateString(r.date)}</td>
                    <td>{r.lecture_id === 0 ? 'Full day' : `Session ${r.lecture_id}`}</td>
                    <td>
                      <span className={`badge ${r.status === 'present' ? 'badge--success' : 'badge--danger'}`}>
                        {r.status === 'present' ? 'Present' : 'Absent'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {activeTab === 'leaves' && (
        <>
          <LeaveBalancePanel balance={data?.balance} />

          <Panel flush title="Leave applications">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Type</th><th>From</th><th>To</th><th>Part</th><th>Status</th><th>HOD comment</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="no-data-cell">Loading…</td></tr>
                  ) : error ? (
                    <tr><td colSpan={7} className="no-data-cell">{error}</td></tr>
                  ) : leaveRows.length === 0 ? (
                    <tr><td colSpan={7} className="no-data-cell">No leave applications yet.</td></tr>
                  ) : leaveRows.map((l) => (
                    <tr
                      key={l.id}
                      ref={l.id === opened.leave ? highlightRef : null}
                      className={`row-link${l.id === opened.leave ? ' leave-row--highlight' : ''}`}
                      onClick={() => openLeave(l.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          openLeave(l.id);
                        }
                      }}
                    >
                      <td className="attendance-capitalize">{l.leave_type || EMPTY_VALUE}</td>
                      {/* l.from_date/to_date are Laravel date-cast timestamps, same as
                          r.date above; localDateString undoes the UTC-midnight shift. */}
                      <td>{localDateString(l.from_date) || EMPTY_VALUE}</td>
                      <td>{localDateString(l.to_date) || EMPTY_VALUE}</td>
                      <td>{DAY_PART_LABEL[l.day_part] || l.day_part || EMPTY_VALUE}</td>
                      <td><span className={badgeClass(l.status)}>{l.status}</span></td>
                      <td>{l.hod_comments || EMPTY_VALUE}</td>
                      <td>
                        {l.status === 'draft' && (
                          <button
                            type="button"
                            className="icon-action"
                            title="Delete this draft"
                            aria-label="Delete this draft"
                            onClick={(e) => { e.stopPropagation(); deleteDraft(l.id); }}
                          >
                            <i className="fa fa-trash" aria-hidden="true"></i>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      <CustomModal isOpen={!!openForm} onClose={handleCloseForm} closeOnOutsideClick={false} width="90vw" minHeight="300px" maxHeight="85vh">
        {openForm && <StudentLeave formData={openForm} onDraftDeleted={handleCloseForm} />}
      </CustomModal>
    </Page>
  );
};

export default StudentAttendancePage;
