import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import Tabs from '../../components/tabs/Tabs';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch, isNetworkError, NETWORK_ERROR_MESSAGE } from '../../api/base';
import { apiDepartmentList } from '../../api/lookups';
import CustomButton from '../../components/forms/fields/CustomButton';
import LeaveRequests from './LeaveRequests';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { countAbsent, applyMarkAll, buildSaveMessage } from '../../utils/attendanceMark';
import { EMPTY_VALUE, toDateValue as formatDate, toDateObject as parseDate } from '../../utils/timeParse';
import './AttendancePage.css';
import { currentRole } from '../../auth/access';
import AttendanceCsvDialog from './AttendanceCsvDialog';
import LoadError from '../../components/common/LoadError';
import AttendanceSummary from './AttendanceSummary';
import useDoneFlash from '../../hooks/useDoneFlash';

const EDIT_WINDOW = 7;

// Named as this page has always called them; the implementations moved to
// timeParse so the profile's attendance range uses the same two.
const todayString = () => formatDate(new Date());

const AttendancePage = () => {
  const [activeTab, setActiveTab] = useState('mark');
  const [date, setDate] = useState(todayString());
  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [departments, setDepartments] = useState([]);
  // An empty list before the answer read as "No departments exist yet."
  const [departmentsLoaded, setDepartmentsLoaded] = useState(false);
  // '' means All Departments for an admin. A clerk with several departments
  // gets the same choice across their own; a clerk with one is pinned to it.
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [students, setStudents] = useState([]);
  // Narrows the roster and the monthly table to one scholar. A view filter
  // only: what is saved is still every scholar loaded for the date, so hiding
  // a row cannot drop the mark somebody already made on it.
  //
  // Seeded from ?roll_no=, which a scholar's profile sends, so View attendance
  // lands on that scholar rather than on the whole roster. Read once on mount
  // because that is the only way the page is entered with one.
  const [scholarFilter, setScholarFilter] = useState(
    () => new URLSearchParams(window.location.search).get('roll_no') || ''
  );
  const [statuses, setStatuses] = useState({});
  // The marks as loaded, so a date or department change can tell whether it
  // would throw away marks the user made and has not saved.
  const loadedStatuses = useRef({});
  const [loading, setLoading] = useState(false);
  // One flag per loader: a failed answer otherwise read as "nothing here", or
  // left a caption saying it was still loading.
  const [rosterFailed, setRosterFailed] = useState(false);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [summaryFailed, setSummaryFailed] = useState(false);
  const [monthFailed, setMonthFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [saved, flashSaved] = useDoneFlash();
  const [exported, flashExported] = useDoneFlash();
  // history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLastPage, setHistoryLastPage] = useState(1);
  const [daySummary, setDaySummary] = useState(null);
  const [scholarHistory, setScholarHistory] = useState(null);
  const [scholarHistoryLoading, setScholarHistoryLoading] = useState(false);
  // monthly
  const [monthData, setMonthData] = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);
  // export (dept-level, no individual student picker)
  const [exportFrom, setExportFrom] = useState(todayString());
  const [exportTo, setExportTo] = useState(todayString());
  const [exportDept, setExportDept] = useState('');

  const role = currentRole();
  const isAdmin = role === 'admin';

  // Switching date or department while a load is in flight leaves two answers
  // racing back. If the older roster landed last, Save posted its marks under
  // the newer date. Each loader numbers its requests and only the newest writes.
  const rosterRequest = useRef(0);
  const historyRequest = useRef(0);
  const summaryRequest = useRef(0);
  const monthRequest = useRef(0);

  useEffect(() => {
    const request = isAdmin
      ? apiDepartmentList()
      : customFetch(baseURL + '/clerks/my-departments', 'GET', {}, false);
    request
      .then((res) => {
        const raw = isAdmin
          ? (res.response?.data || res.response?.departments || res.response || [])
          : (res.response?.departments || []);
        const list = (Array.isArray(raw) ? raw : []).map((d) => ({ id: d.id, name: d.name, code: d.code }));
        setDepartments(list);
        // A clerk tagged with exactly one department has no choice to make, so
        // pin the filter to it rather than showing a one-item dropdown.
        if (!isAdmin && list.length === 1) setDepartmentFilter(String(list[0].id));
      })
      .catch(() => setDepartments([]))
      .finally(() => setDepartmentsLoaded(true));
  }, [isAdmin]);

  const loadRoster = useCallback(async () => {
    const request = ++rosterRequest.current;
    setLoading(true);
    setRosterFailed(false);
    setStudents([]);
    setStatuses({});
    loadedStatuses.current = {};
    const params = new URLSearchParams({ date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance?${params.toString()}`, 'GET', {}, true);
    if (request !== rosterRequest.current) return;
    setLoading(false);
    if (!res.success) { setStudents([]); setRosterFailed(true); return; }
    const list = res.response.students || [];
    setStudents(list);
    const next = {};
    const isToday = date === todayString();
    list.forEach((s) => {
      if (s.status != null) next[s.roll_no] = s.status;
      // Deliberately not excluding s.on_leave here: a same-day scholar on
      // leave still gets this 'present' default, which rides along into
      // handleSave's `records` and lets the backend report them in
      // skipped_on_leave (it always refuses to write their row either way).
      // Nulling this out for on-leave scholars would silently stop the save
      // toast's skip notice from ever firing on the common same-day case.
      else next[s.roll_no] = isToday ? 'present' : null;
    });
    loadedStatuses.current = next;
    setStatuses(next);
  }, [date, departmentFilter]);

  // Reloads on a new date or department only. Reloading on a tab switch reset
  // every mark, so glancing at Monthly threw away unsaved attendance.
  useEffect(() => { loadRoster(); }, [loadRoster]);

  const hasUnsavedMarks = students.some((s) => statuses[s.roll_no] !== loadedStatuses.current[s.roll_no]);
  const confirmDiscardMarks = () => !hasUnsavedMarks
    || window.confirm(`Discard the attendance you marked for ${date} and have not saved?`);

  const loadHistory = useCallback(async () => {
    const request = ++historyRequest.current;
    setHistoryLoading(true);
    setHistoryFailed(false);
    setHistory([]);
    const params = new URLSearchParams({ page: String(historyPage), per_page: '15' });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance/history?${params.toString()}`, 'GET', {}, true);
    if (request !== historyRequest.current) return;
    setHistoryLoading(false);
    if (!res.success) { setHistory([]); setHistoryFailed(true); return; }
    setHistory(res.response.data || res.response || []);
    setHistoryTotal(res.response.total || 0);
    setHistoryLastPage(res.response.last_page || 1);
  }, [departmentFilter, historyPage]);

  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  const loadDaySummary = useCallback(async () => {
    const request = ++summaryRequest.current;
    setDaySummary(null);
    setSummaryFailed(false);
    const params = new URLSearchParams({ date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance/summary?${params.toString()}`, 'GET', {}, false);
    if (request !== summaryRequest.current) return;
    if (res.success) setDaySummary(res.response);
    else setSummaryFailed(true);
  }, [date, departmentFilter]);

  useEffect(() => { if (activeTab === 'history') loadDaySummary(); }, [activeTab, loadDaySummary]);

  const loadMonth = useCallback(async () => {
    const request = ++monthRequest.current;
    setMonthLoading(true);
    setMonthFailed(false);
    setMonthData(null);
    const params = new URLSearchParams({ month });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance/month?${params.toString()}`, 'GET', {}, false);
    if (request !== monthRequest.current) return;
    setMonthLoading(false);
    if (res.success) setMonthData(res.response);
    else setMonthFailed(true);
  }, [month, departmentFilter]);

  useEffect(() => { if (activeTab === 'monthly') loadMonth(); }, [activeTab, loadMonth]);

  const setStatus = (rollNo, status) => setStatuses((prev) => ({ ...prev, [rollNo]: status }));
  // A scholar on approved leave has no radio to bulk-set — the backend
  // refuses to write their attendance row either way — so bulk actions must
  // leave their entry alone.
  const matchesScholar = (scholar, text) => {
    const needle = text.trim().toLowerCase();
    if (!needle) return true;
    return String(scholar.roll_no).includes(needle) || (scholar.name || '').toLowerCase().includes(needle);
  };

  const visibleStudents = useMemo(
    () => students.filter((s) => matchesScholar(s, scholarFilter)),
    [students, scholarFilter]
  );

  const visibleMonthStudents = useMemo(
    () => (monthData?.students || []).filter((s) => matchesScholar(s, scholarFilter)),
    [monthData, scholarFilter]
  );

  // Past Sessions lists one row per day for the whole department. Naming a
  // scholar turns it into that scholar's own record, which is the only way to
  // read how much of the term they actually attended.
  const filteredRoll = useMemo(() => {
    const text = scholarFilter.trim();
    if (!text) return null;
    if (/^\d+$/.test(text)) return text;
    const matches = students.filter((s) => matchesScholar(s, text));
    return matches.length === 1 ? String(matches[0].roll_no) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scholarFilter, students]);

  useEffect(() => {
    if (activeTab !== 'history' || !filteredRoll) { setScholarHistory(null); return; }

    let cancelled = false;
    setScholarHistoryLoading(true);
    customFetch(baseURL + `/clerks/attendance/student/${filteredRoll}`, 'GET', {}, false)
      .then((res) => {
        if (cancelled) return;
        setScholarHistoryLoading(false);
        setScholarHistory(res.success ? res.response : null);
      });

    return () => { cancelled = true; };
  }, [activeTab, filteredRoll]);

  const markAll = (status) => setStatuses((prev) => applyMarkAll(visibleStudents, prev, status));
  const absentCount = useMemo(() => countAbsent(visibleStudents, statuses), [visibleStudents, statuses]);

  const handleSave = async () => {
    if (students.length === 0) { toast.info('Nothing to save'); return; }
    // Not filtering out s.on_leave here either: keeping an on-leave scholar's
    // (possibly default) status in `records` is what lets the server see and
    // report them in skipped_on_leave below — see the matching note in
    // loadRoster. Excluding them here would drop that signal just as quietly.
    const records = students.filter((s) => statuses[s.roll_no] === 'present' || statuses[s.roll_no] === 'absent').map((s) => ({ roll_no: s.roll_no, status: statuses[s.roll_no] }));
    if (records.length === 0) { toast.info('No attendance marked, so it is treated as no session (nothing saved)'); return; }
    if (records.length < students.length) toast.info(`${students.length - records.length} unmarked scholar(s) will be left as no session`);
    setSaving(true);
    const res = await customFetch(baseURL + '/clerks/attendance', 'POST', { date, records }, true);
    setSaving(false);
    if (res.success) {
      toast.success(buildSaveMessage(res.response.message, res.response.skipped_on_leave));
      flashSaved();
      loadRoster();
    }
  };

  const confirmExport = async () => {
    if (exportFrom > exportTo) { toast.error('From date cannot be after To date'); return; }
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ from: exportFrom, to: exportTo, summary: '1' });
    if (exportDept) params.set('department_id', exportDept);
    try {
      const res = await fetch(baseURL + `/clerks/attendance/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { toast.error('Export failed.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `attendance_${exportFrom}_to_${exportTo}.csv`; a.click(); URL.revokeObjectURL(url);
      toast.success('Export downloaded.');
      flashExported();
    } catch (e) { toast.error(isNetworkError(e) ? NETWORK_ERROR_MESSAGE : 'Export failed: ' + e.message); }
  };

  const todayDate = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const minSelectableDate = useMemo(() => {
    if (isAdmin) return null;
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - EDIT_WINDOW); return d;
  }, [isAdmin]);

  const saveButton = <CustomButton text="Save attendance" onClick={handleSave} busy={saving} done={saved} disabled={loading} />;
  const departmentName = (id) => departments.find((d) => String(d.id) === String(id))?.name;

  return (
    <Page
      title="Attendance"
      description={!departmentsLoaded ? 'Loading departments…' : departments.length > 0 ? `${departments.map((d) => d.name).join(', ')}` : (isAdmin ? 'No departments exist yet.' : 'Your departments will appear here once an admin tags you.')}
      actions={(
        <CustomButton
          text="Upload CSV"
          variant="secondary"
          // The import reloads the roster, which would drop unsaved marks
          // after the fact; ask while backing out still costs nothing.
          onClick={() => confirmDiscardMarks() && setShowCsvModal(true)}
        />
      )}
      tabs={
        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          items={[
            { value: 'mark', label: 'Mark attendance' },
            { value: 'history', label: 'Past sessions' },
            { value: 'monthly', label: 'Monthly' },
            { value: 'export', label: 'Export' },
            // The HOD decides leave; an admin reads every department's
            // applications alongside, without a decision of their own.
            ...(isAdmin ? [{ value: 'leaves', label: 'Leave requests' }] : []),
          ]}
        />
      }
    >
      {activeTab !== 'export' && (
        <Panel>
          <div className="attendance-filters">
            <div className="input-field-container">
              <label className="input-label" htmlFor="attendance-page-department">Department</label>
              <select id="attendance-page-department"
                className="input-field"
                value={departmentFilter}
                onChange={(e) => {
                  if (!confirmDiscardMarks()) return;
                  setDepartmentFilter(e.target.value);
                  setHistoryPage(1);
                }}
                disabled={!isAdmin && departments.length <= 1}
              >
                {(isAdmin || departments.length > 1) && <option value="">All departments</option>}
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {(activeTab === 'mark' || activeTab === 'monthly' || activeTab === 'history') && (
              <div className="input-field-container">
                <label className="input-label" htmlFor="attendance-page-scholar">Scholar</label>
                <input
                  id="attendance-page-scholar"
                  className="input-field"
                  type="search"
                  value={scholarFilter}
                  onChange={(e) => setScholarFilter(e.target.value)}
                  placeholder="Roll number or name"
                />
              </div>
            )}

            {(activeTab === 'mark' || activeTab === 'history') && (
              <div className="input-field-container">
                <label className="input-label" htmlFor="attendance-page-date">
                  Date {date === todayString() && <span className="badge badge--success attendance-today-badge">Today</span>}
                </label>
                <DatePicker id="attendance-page-date"
                  selected={parseDate(date)}
                  onChange={(d) => d && formatDate(d) !== date && confirmDiscardMarks() && setDate(formatDate(d))}
                  dateFormat="yyyy-MM-dd"
                  className="input-field"
                  placeholderText="YYYY-MM-DD"
                  minDate={minSelectableDate}
                  maxDate={todayDate}
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                />
              </div>
            )}

            {activeTab === 'monthly' && (
              <div className="input-field-container">
                <label className="input-label" htmlFor="attendance-page-month">Month</label>
                <DatePicker id="attendance-page-month"
                  selected={parseDate(month + '-01')}
                  onChange={(d) => d && setMonth(formatDate(d).slice(0, 7))}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="input-field"
                  maxDate={todayDate}
                />
              </div>
            )}
          </div>
        </Panel>
      )}

      {activeTab === 'leaves' && isAdmin && (
        <LeaveRequests departmentId={departmentFilter} showDepartment />
      )}

      {/* Mark tab */}
      {activeTab === 'mark' && (
        departmentsLoaded && departments.length === 0 && !loading ? (
          <Panel>
            <StatusNotice tone="empty">{isAdmin ? 'No departments exist yet.' : 'No departments are assigned to you yet. Please contact an administrator.'}</StatusNotice>
          </Panel>
        ) : (
          <Panel
            flush
            title="Scholars"
            description={
              <span className="attendance-counts">
                <span>{visibleStudents.length} scholar(s){scholarFilter.trim() && ` of ${students.length}`}</span>
                <span key={absentCount} className="badge badge--danger attendance-absent-count">{absentCount} absent</span>
              </span>
            }
            actions={visibleStudents.length > 0 && !loading && (
              <>
                <CustomButton text="Mark all present" variant="secondary" onClick={() => markAll('present')} />
                <CustomButton text="Mark all absent" variant="secondary" onClick={() => markAll('absent')} />
                <CustomButton text="Reset marks" variant="quiet" onClick={() => setStatuses(loadedStatuses.current)} disabled={!hasUnsavedMarks} />
                {saveButton}
              </>
            )}
            footer={visibleStudents.length > 0 && <span className="attendance-foot-end">{saveButton}</span>}
          >
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Roll no</th><th>Name</th><th>Department</th><th>Status</th><th>Record</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="no-data-cell">Loading…</td></tr>
                    : rosterFailed ? <tr><td colSpan={5} className="no-data-cell"><LoadError message="Could not load the scholars for this date. Check your connection and try again." onRetry={loadRoster} /></td></tr>
                    : visibleStudents.length === 0 ? <tr><td colSpan={5} className="no-data-cell">{scholarFilter.trim() ? 'No scholar matches that roll number or name.' : 'No PhD scholars found for this selection.'}</td></tr>
                    : visibleStudents.map((s) => {
                      const cur = statuses[s.roll_no];
                      return (
                        <tr key={s.roll_no} className="reveal">
                          <td>{s.roll_no}</td><td>{s.name}</td><td>{s.department_name || s.department_code || '-'}</td>
                          <td>
                            {s.on_leave ? (
                              <span className="badge badge--neutral">On leave · {s.leave_type}</span>
                            ) : (
                              <span className="attendance-status-choice">
                                <label className={'attendance-status-option' + (cur === 'present' ? ' is-chosen' : '')}>
                                  <input type="radio" name={`status-${s.roll_no}`} checked={cur === 'present'} onChange={() => setStatus(s.roll_no, 'present')} /> Present
                                </label>
                                <label className={'attendance-status-option' + (cur === 'absent' ? ' is-chosen is-absent' : '')}>
                                  <input type="radio" name={`status-${s.roll_no}`} checked={cur === 'absent'} onChange={() => setStatus(s.roll_no, 'absent')} /> Absent
                                </label>
                              </span>
                            )}
                          </td>
                          <td className="attendance-marked-by">
                            {s.recorded ? (s.marked_by_name ? <span title={`Marked by ${s.marked_by_name}`}>by {s.marked_by_name}</span> : <span className="attendance-note-muted">Recorded</span>) : <span className="attendance-note-muted" title="No record, treated as no session">No session</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Panel>
        )
      )}

      {/* History tab, one scholar */}
      {activeTab === 'history' && filteredRoll && (
        <>
          <AttendanceSummary
            title="Scholar summary"
            caption={scholarHistoryLoading
              ? 'Loading the scholar’s record…'
              : scholarHistory
                ? `${scholarHistory.student.name} (${scholarHistory.student.roll_no}) · all sessions to date · days covered by an approved leave are left out`
                : 'No record for that scholar.'}
            stats={[
              { label: 'Present', tone: 'present', value: scholarHistory ? scholarHistory.summary.present : EMPTY_VALUE },
              { label: 'Absent', tone: 'absent', value: scholarHistory ? scholarHistory.summary.absent : EMPTY_VALUE },
              { label: 'Sessions', value: scholarHistory ? scholarHistory.summary.total : EMPTY_VALUE },
              { label: 'Attendance', value: scholarHistory && scholarHistory.summary.percent != null ? `${scholarHistory.summary.percent}%` : EMPTY_VALUE },
            ]}
          />
          <Panel flush title="Sessions">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Date</th><th>Status</th><th>Marked by</th></tr></thead>
                <tbody>
                  {scholarHistoryLoading ? <tr><td colSpan={3} className="no-data-cell">Loading…</td></tr>
                    : !scholarHistory || scholarHistory.records.length === 0 ? <tr><td colSpan={3} className="no-data-cell">No attendance recorded for this scholar yet.</td></tr>
                    : scholarHistory.records.map((r) => (
                      <tr key={`${r.date}-${r.lecture_id}`} className="reveal">
                        <td>{r.date?.slice?.(0, 10) || r.date}</td>
                        <td className={r.status === 'absent' ? 'attendance-status-absent' : 'attendance-status-present'}>{r.status}</td>
                        <td>{r.marked_by || EMPTY_VALUE}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {/* History tab, the whole department */}
      {activeTab === 'history' && !filteredRoll && (
        <>
          {scholarFilter.trim() && (
            <StatusNotice tone="info">
              That matches no single scholar, so the sessions below are still the whole selection.
            </StatusNotice>
          )}
          <AttendanceSummary
            title="Day summary"
            caption={summaryFailed ? undefined : daySummary
              ? `${departmentFilter ? (departmentName(departmentFilter) || 'Selected department') : 'All departments'} · ${date} · ${daySummary.scholars} scholar(s) on the roster`
              : 'Loading the day’s figures…'}
            stats={[
              { label: 'Present', tone: 'present', value: daySummary ? daySummary.present : EMPTY_VALUE },
              { label: 'Absent', tone: 'absent', value: daySummary ? daySummary.absent : EMPTY_VALUE },
              { label: 'Not recorded', value: daySummary ? daySummary.not_recorded : EMPTY_VALUE },
              { label: 'Attendance', value: daySummary && daySummary.percent != null ? `${daySummary.percent}%` : EMPTY_VALUE },
            ]}
          >
            {summaryFailed && (
              <LoadError message="Could not load the figures for this day. Check your connection and try again." onRetry={loadDaySummary} />
            )}
          </AttendanceSummary>
          <Panel
            flush
            title="Past sessions"
            footer={historyTotal > 15 && (
              <div className="attendance-pager">
                <CustomButton text="Previous" variant="quiet" size="sm" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p-1))} />
                <span>Page {historyPage} / {historyLastPage}</span>
                <CustomButton text="Next" variant="quiet" size="sm" disabled={historyPage >= historyLastPage} onClick={() => setHistoryPage((p) => p+1)} />
              </div>
            )}
          >
            <div className="data-table-wrap">
              <table className="data-table">
                <thead><tr><th>Date (not filtered by the date above)</th><th>Total</th><th>Present</th><th>Absent</th><th>Action</th></tr></thead>
                <tbody>
                  {historyLoading ? <tr><td colSpan={5} className="no-data-cell">Loading…</td></tr>
                    : historyFailed ? <tr><td colSpan={5} className="no-data-cell"><LoadError message="Could not load past sessions. Check your connection and try again." onRetry={loadHistory} /></td></tr>
                    : history.length === 0 ? <tr><td colSpan={5} className="no-data-cell">No past sessions yet.</td></tr>
                    : history.map((h) => (
                      <tr key={`${h.date}-${h.lecture_id}`} className="reveal">
                        <td>{h.date?.slice?.(0,10) || h.date}</td><td>{h.total}</td><td className="attendance-status-present">{h.present_count}</td><td className="attendance-status-absent">{h.absent_count}</td>
                        <td><CustomButton text="View" variant="secondary" size="sm" onClick={() => {
                          const viewed = h.date.slice(0, 10);
                          if (viewed !== date && !confirmDiscardMarks()) return;
                          setDate(viewed);
                          setActiveTab('mark');
                        }} /></td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {/* Monthly tab */}
      {activeTab === 'monthly' && (
        <>
          <AttendanceSummary
            title="Month summary"
            caption={monthFailed ? undefined : monthData ? `${monthData.label} · per-scholar totals for the month` : 'Loading the month…'}
            stats={[
              { label: 'Sessions held', value: monthData ? monthData.days_with_sessions : EMPTY_VALUE },
              { label: 'Total present', tone: 'present', value: monthData ? monthData.totals.present : EMPTY_VALUE },
              { label: 'Total absent', tone: 'absent', value: monthData ? monthData.totals.absent : EMPTY_VALUE },
            ]}
          />
          <Panel flush title="Scholars">
            <div className="data-table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Roll no</th><th>Name</th><th>Department</th><th>Present</th><th>Absent</th><th>Sessions</th><th>Attendance</th></tr>
                </thead>
                <tbody>
                  {monthLoading ? (
                    <tr><td colSpan={7} className="no-data-cell">Loading…</td></tr>
                  ) : monthFailed ? (
                    <tr><td colSpan={7} className="no-data-cell"><LoadError message="Could not load this month's attendance. Check your connection and try again." onRetry={loadMonth} /></td></tr>
                  ) : !monthData || visibleMonthStudents.length === 0 ? (
                    <tr><td colSpan={7} className="no-data-cell">{scholarFilter.trim() ? 'No scholar matches that roll number or name.' : 'No scholars for this selection.'}</td></tr>
                  ) : visibleMonthStudents.map((s) => (
                    <tr key={s.roll_no} className="reveal">
                      <td>{s.roll_no}</td>
                      <td>{s.name}</td>
                      <td>{s.department_name || EMPTY_VALUE}</td>
                      <td className="attendance-status-present">{s.present}</td>
                      <td className="attendance-status-absent">{s.absent}</td>
                      <td>{s.total}</td>
                      <td>{s.percent != null ? `${s.percent}%` : EMPTY_VALUE}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </>
      )}

      {/* Export tab */}
      {activeTab === 'export' && (
        <Panel
          title="Export attendance"
          description={`${exportDept ? `Exports all scholars in ${departmentName(exportDept) || 'the selected department'} for the chosen range.` : 'Exports all scholars you can access for the chosen range.'} Includes present counts per scholar.`}
        >
          <div className="attendance-filters">
            <div className="input-field-container">
              <label className="input-label" htmlFor="attendance-page-from">From</label>
              <DatePicker id="attendance-page-from" selected={parseDate(exportFrom)} onChange={(d) => d && setExportFrom(formatDate(d))} dateFormat="yyyy-MM-dd" className="input-field" placeholderText="YYYY-MM-DD" maxDate={todayDate} />
            </div>
            <div className="input-field-container">
              <label className="input-label" htmlFor="attendance-page-to">To</label>
              <DatePicker id="attendance-page-to" selected={parseDate(exportTo)} onChange={(d) => d && setExportTo(formatDate(d))} dateFormat="yyyy-MM-dd" className="input-field" placeholderText="YYYY-MM-DD" minDate={parseDate(exportFrom)} maxDate={todayDate} />
            </div>
            <div className="input-field-container">
              <label className="input-label" htmlFor="attendance-page-department-2">Department</label>
              <select id="attendance-page-department-2" className="input-field" value={exportDept} onChange={(e) => setExportDept(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="attendance-filters-action">
              <CustomButton text="Download CSV" onClick={confirmExport} done={exported} disabled={exportFrom > exportTo} />
            </div>
          </div>
          {exportFrom > exportTo && (
            <div className="attendance-date-warning">
              <StatusNotice tone="error">From date cannot be after To date.</StatusNotice>
            </div>
          )}
        </Panel>
      )}

      <AttendanceCsvDialog
        isOpen={showCsvModal}
        onClose={() => setShowCsvModal(false)}
        onImported={loadRoster}
        editWindow={EDIT_WINDOW}
      />
    </Page>
  );
};
export default AttendancePage;
