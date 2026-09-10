import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import StudentLeave from '../../components/forms/studentLeave/StudentLeave';
import LeaveBalancePanel from './LeaveBalancePanel';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { apiLeaveCreate, apiLeaveLoad, apiLeaveDelete } from '../../api/leave';
import { badgeClass } from '../../data/badges';
import { parseAttendanceQuery, localDateString, localMonthKey } from '../../utils/leaveBalance';
import { EMPTY_VALUE } from '../../utils/timeParse';
import './AttendancePage.css';

const DAY_PART_LABEL = { full: 'Full day', first_half: 'First half', second_half: 'Second half' };

/**
 * A scholar's own attendance — Monthly and Sessions here, Leaves in Task 11.
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
        if (res?.success) setData(res.response);
        else setError('Could not load your attendance records. Please try again later.');
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
    <Layout>
      <PageHeader
        title="My Attendance"
        actions={
          <CustomButton
            text={applying ? 'Opening…' : 'Apply for Leave'}
            onClick={handleApply}
            disabled={applying}
          />
        }
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'monthly', label: 'Monthly' },
          { value: 'sessions', label: 'Sessions' },
          { value: 'leaves', label: 'Leaves' },
        ]}
      />

      {data && (
        <div className="attendance-summary-cards" style={{ marginTop: '1rem' }}>
          <div className="attendance-summary-card">
            <span className="attendance-summary-label">Sessions</span>
            <span className="attendance-summary-value">{data.summary.total}</span>
          </div>
          <div className="attendance-summary-card">
            <span className="attendance-summary-label">Present</span>
            <span className="attendance-summary-value present">{data.summary.present}</span>
          </div>
          <div className="attendance-summary-card">
            <span className="attendance-summary-label">Absent</span>
            <span className="attendance-summary-value absent">{data.summary.absent}</span>
          </div>
          <div className="attendance-summary-card">
            <span className="attendance-summary-label">Attendance</span>
            <span className="attendance-summary-value">
              {data.summary.percent != null ? `${data.summary.percent}%` : EMPTY_VALUE}
            </span>
          </div>
          <p className="attendance-summary-caption">
            {data.current_month?.label ? `${data.current_month.label} · ` : ''}
            All-time figures for {data.student?.name || 'you'}
          </p>
        </div>
      )}

      {activeTab === 'monthly' && (
        <div className="form-list-container" style={{ marginTop: '1rem' }}>
          <table className="form-table">
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
                  <td style={{ color: 'var(--success-text)' }}>{m.present}</td>
                  <td style={{ color: 'var(--danger-text)' }}>{m.absent}</td>
                  <td>{m.total}</td>
                  {/* A bucket only exists here when a record created it, so m.total is
                      always >= 1 — unlike the backend's AttendanceSummary (which can see
                      a genuinely zero-session set and prints '—' for it), there is no
                      zero-session case to guard against on this table. */}
                  <td>{Math.round((m.present / m.total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="form-list-container" style={{ marginTop: '1rem' }}>
          <table className="form-table">
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
                      above — r.date is not a plain YYYY-MM-DD string, it's a Laravel
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
      )}

      {activeTab === 'leaves' && (
        <div style={{ marginTop: '1rem' }}>
          <LeaveBalancePanel balance={data?.balance} />

          <div className="form-list-container">
            <table className="form-table">
              <thead>
                <tr><th>Type</th><th>From</th><th>To</th><th>Part</th><th>Status</th><th>HOD comment</th><th></th></tr>
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
                    className={l.id === opened.leave ? 'leave-row--highlight' : undefined}
                    style={{ cursor: 'pointer' }}
                    onClick={() => openLeave(l.id)}
                  >
                    <td style={{ textTransform: 'capitalize' }}>{l.leave_type || EMPTY_VALUE}</td>
                    {/* l.from_date/to_date are Laravel date-cast timestamps, same as
                        r.date above — localDateString undoes the UTC-midnight shift. */}
                    <td>{localDateString(l.from_date) || EMPTY_VALUE}</td>
                    <td>{localDateString(l.to_date) || EMPTY_VALUE}</td>
                    <td>{DAY_PART_LABEL[l.day_part] || l.day_part || EMPTY_VALUE}</td>
                    <td><span className={badgeClass(l.status)}>{l.status}</span></td>
                    <td>{l.hod_comments || EMPTY_VALUE}</td>
                    <td>
                      {l.status === 'draft' && (
                        <button
                          type="button"
                          className="leave-draft-delete"
                          title="Delete this draft"
                          onClick={(e) => { e.stopPropagation(); deleteDraft(l.id); }}
                        >
                          <i className="fa fa-trash"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <CustomModal isOpen={!!openForm} onClose={handleCloseForm} width="90vw" minHeight="300px" maxHeight="85vh">
        {openForm && <StudentLeave formData={openForm} />}
      </CustomModal>
    </Layout>
  );
};

export default StudentAttendancePage;
