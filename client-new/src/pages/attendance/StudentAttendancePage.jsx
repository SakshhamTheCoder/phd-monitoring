import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import Tabs from '../../components/tabs/Tabs';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import StudentLeave from '../../components/forms/studentLeave/StudentLeave';
import AttendanceSummary from './AttendanceSummary';
import { apiLeaveCreate, apiLeaveLoad, apiLeaveDelete } from '../../api/leave';
import { useView } from '../../api/views';
import { badgeClass } from '../../data/badges';
import { parseAttendanceQuery } from '../../utils/leaveBalance';
import './AttendancePage.css';

const FAILED = 'Could not load your attendance records. Please try again later.';

/**
 * A scholar's own attendance: by month, by session, and their leave. Unlike
 * AttendancePage (a clerk marking many students across departments), this
 * page has exactly one student: the signed-in scholar. Every figure and label
 * is the server's (App\Pages\MyAttendancePage); applying for leave and
 * reading an application are this page's own.
 */
const StudentAttendancePage = () => {
  const location = useLocation();
  const opened = useMemo(() => parseAttendanceQuery(location.search), [location.search]);
  const [activeTab, setActiveTab] = useState(opened.tab === 'leaves' ? 'leaves' : 'monthly');
  const { view, failed, reload } = useView('my-attendance', {}, { kept: false });
  // The tables must not read as "no records" before the first answer.
  const loading = !view && !failed;
  const error = failed ? FAILED : view?.error ?? null;
  // What the page shows once the records could be read.
  const data = view && !view.error ? view : null;
  const [openForm, setOpenForm] = useState(null); // full fullForm() json, or null
  const [applying, setApplying] = useState(false);
  const highlightRef = useRef(null);

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
    reload();
  };

  const months = data?.months || [];
  const records = data?.sessions || [];
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
    if (res.success) reload();
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
      {data && <AttendanceSummary title={data.summary.title} caption={data.summary.caption} stats={data.summary.stats} />}

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
                    <td>{m.percent}</td>
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
                  <tr key={r.key}>
                    <td>{r.date}</td>
                    <td>{r.session}</td>
                    <td>
                      <span className={`badge ${r.present ? 'badge--success' : 'badge--danger'}`}>
                        {r.status}
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
          {data?.balance && (
            <AttendanceSummary
              title={data.balance.title}
              caption={data.balance.caption ?? undefined}
              stats={data.balance.stats.map((stat) => ({
                ...stat,
                note: <span className={`badge badge--${stat.note.tone}`}>{stat.note.text}</span>,
              }))}
            />
          )}

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
                      <td className="attendance-capitalize">{l.type}</td>
                      <td>{l.from}</td>
                      <td>{l.to}</td>
                      <td>{l.part}</td>
                      <td><span className={badgeClass(l.status)}>{l.status}</span></td>
                      <td>{l.hod_comments}</td>
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
