import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import Tabs from '../../components/tabs/Tabs';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './AttendancePage.css';

const EDIT_WINDOW = 7;

const todayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};
const formatDate = (d) => {
  if (!d) return '';
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};
const parseDate = (str) => {
  if (!str) return null;
  return new Date(str + 'T00:00:00');
};

const AttendancePage = () => {
  const [activeTab, setActiveTab] = useState('mark');
  const [date, setDate] = useState(todayString());
  const [month, setMonth] = useState(todayString().slice(0, 7));
  const [departments, setDepartments] = useState([]);
  // '' means All Departments for an admin. A clerk with several departments
  // gets the same choice across their own; a clerk with one is pinned to it.
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  // history
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLastPage, setHistoryLastPage] = useState(1);
  const [daySummary, setDaySummary] = useState(null);
  // monthly
  const [monthData, setMonthData] = useState(null);
  const [monthLoading, setMonthLoading] = useState(false);
  // export (dept-level, no individual student picker)
  const [exportFrom, setExportFrom] = useState(todayString());
  const [exportTo, setExportTo] = useState(todayString());
  const [exportDept, setExportDept] = useState('');

  const role = localStorage.getItem('userRole');
  const isAdmin = role === 'admin';

  useEffect(() => {
    const url = isAdmin ? '/departments' : '/clerks/my-departments';
    customFetch(baseURL + url, 'GET', {}, false)
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
      .catch(() => setDepartments([]));
  }, [isAdmin]);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    setStudents([]);
    setStatuses({});
    const params = new URLSearchParams({ date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance?${params.toString()}`, 'GET', {}, true);
    setLoading(false);
    if (!res.success) { setStudents([]); return; }
    const list = res.response.students || [];
    setStudents(list);
    const next = {};
    const isToday = date === todayString();
    list.forEach((s) => {
      if (s.status != null) next[s.roll_no] = s.status;
      else next[s.roll_no] = isToday ? 'present' : null;
    });
    setStatuses(next);
  }, [date, departmentFilter]);

  useEffect(() => { if (activeTab === 'mark') loadRoster(); }, [loadRoster, activeTab]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistory([]);
    const params = new URLSearchParams({ page: String(historyPage), per_page: '15' });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance/history?${params.toString()}`, 'GET', {}, true);
    setHistoryLoading(false);
    if (!res.success) { setHistory([]); return; }
    setHistory(res.response.data || res.response || []);
    setHistoryTotal(res.response.total || 0);
    setHistoryLastPage(res.response.last_page || 1);
  }, [departmentFilter, historyPage]);

  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  const loadDaySummary = useCallback(async () => {
    setDaySummary(null);
    const params = new URLSearchParams({ date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance/summary?${params.toString()}`, 'GET', {}, false);
    if (res.success) setDaySummary(res.response);
  }, [date, departmentFilter]);

  useEffect(() => { if (activeTab === 'history') loadDaySummary(); }, [activeTab, loadDaySummary]);

  const loadMonth = useCallback(async () => {
    setMonthLoading(true);
    setMonthData(null);
    const params = new URLSearchParams({ month });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance/month?${params.toString()}`, 'GET', {}, false);
    setMonthLoading(false);
    if (res.success) setMonthData(res.response);
  }, [month, departmentFilter]);

  useEffect(() => { if (activeTab === 'monthly') loadMonth(); }, [activeTab, loadMonth]);

  const setStatus = (rollNo, status) => setStatuses((prev) => ({ ...prev, [rollNo]: status }));
  const markAll = (status) => {
    const next = {};
    students.forEach((s) => { next[s.roll_no] = status; });
    setStatuses(next);
  };
  const absentCount = useMemo(() => students.filter((s) => statuses[s.roll_no] === 'absent').length, [students, statuses]);

  const handleSave = async () => {
    if (students.length === 0) { toast.info('Nothing to save'); return; }
    const records = students.filter((s) => statuses[s.roll_no] === 'present' || statuses[s.roll_no] === 'absent').map((s) => ({ roll_no: s.roll_no, status: statuses[s.roll_no] }));
    if (records.length === 0) { toast.info('No attendance marked — treated as no session (nothing saved)'); return; }
    if (records.length < students.length) toast.info(`${students.length - records.length} unmarked scholar(s) will be left as no session`);
    setSaving(true);
    const res = await customFetch(baseURL + '/clerks/attendance', 'POST', { date, records }, true);
    setSaving(false);
    if (res.success) { toast.success(res.response.message || 'Attendance saved'); loadRoster(); }
  };

  const downloadTemplate = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(baseURL + '/clerks/attendance/template', { headers: { Authorization: `Bearer ${token}` } });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'attendance_template.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const confirmExport = async () => {
    if (exportFrom > exportTo) { toast.error('From date cannot be after To date'); return; }
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ from: exportFrom, to: exportTo, summary: '1' });
    if (exportDept) params.set('department_id', exportDept);
    const res = await fetch(baseURL + `/clerks/attendance/export?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { toast.error('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `attendance_${exportFrom}_to_${exportTo}.csv`; a.click(); URL.revokeObjectURL(url);
    toast.success('Export downloaded');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) { setCsvFile(null); setCsvPreview(null); return; }
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target.result;
        const rows = text.split('\n').filter(r => r.trim());
        if (rows.length === 0) { setCsvPreview(null); return; }
        const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
        const data = rows.slice(1).slice(0, 5).map((row, i) => {
          const vals = row.split(',').map(v => v.trim());
          const obj = { _row: i+2 };
          headers.forEach((h, idx) => obj[h] = vals[idx] || '');
          return obj;
        });
        setCsvPreview({ headers, data, total: rows.length - 1 });
      } catch { setCsvPreview(null); }
    };
    reader.readAsText(file);
  };

  const handleCsvUpload = async () => {
    if (!csvFile) { toast.error('Select a CSV file'); return; }
    setUploading(true);
    const form = new FormData(); form.append('file', csvFile);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(baseURL + '/clerks/attendance/csv', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'CSV imported');
        if (data.data?.errors?.length) toast.warning(`${data.data.error_count} rows had errors — check console`);
        console.log('CSV import errors', data.data?.errors);
        setShowCsvModal(false); setCsvFile(null); setCsvPreview(null); loadRoster();
      } else toast.error(data.message || 'Import failed');
    } catch (e) { toast.error('Upload failed: ' + e.message); } finally { setUploading(false); }
  };

  const todayDate = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const minSelectableDate = useMemo(() => {
    if (isAdmin) return null;
    const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - EDIT_WINDOW); return d;
  }, [isAdmin]);

  return (
    <Layout>
      <PageHeader
        title="Attendance"
        subtitle={departments.length > 0 ? `${departments.map((d) => d.name).join(', ')}` : 'Your departments will appear here once an admin tags you.'}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <CustomButton text="Upload CSV" variant="secondary" onClick={() => setShowCsvModal(true)} />
          </div>
        }
      />

      <Tabs
        value={activeTab}
        onChange={setActiveTab}
        items={[
          { value: 'mark', label: 'Mark Attendance' },
          { value: 'history', label: 'Past Sessions' },
          { value: 'monthly', label: 'Monthly' },
          { value: 'export', label: 'Export' },
        ]}
      />

      {activeTab !== 'export' && (
        <div className="filter-bar attendance-filters">
          <div className="filter-row" style={{ alignItems: 'flex-end' }}>
            <div className="input-field-container" style={{ minWidth: '220px' }}>
              <label className="input-label">Department</label>
              <select
                className="input-field"
                value={departmentFilter}
                onChange={(e) => { setDepartmentFilter(e.target.value); setHistoryPage(1); }}
                disabled={!isAdmin && departments.length <= 1}
              >
                {(isAdmin || departments.length > 1) && <option value="">All Departments</option>}
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {activeTab !== 'monthly' && (
              <div className="input-field-container" style={{ minWidth: '190px' }}>
                <label className="input-label">
                  Date {date === todayString() && <span className="badge badge--success attendance-today-pill">Today</span>}
                </label>
                <DatePicker
                  selected={parseDate(date)}
                  onChange={(d) => d && setDate(formatDate(d))}
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
              <div className="input-field-container" style={{ minWidth: '190px' }}>
                <label className="input-label">Month</label>
                <DatePicker
                  selected={parseDate(month + '-01')}
                  onChange={(d) => d && setMonth(formatDate(d).slice(0, 7))}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="input-field"
                  maxDate={todayDate}
                />
              </div>
            )}

            <div className="attendance-filter-meta">
              {activeTab === 'mark' && (
                <>
                  <span>{students.length} scholar(s)</span>
                  <span className="badge badge--danger">{absentCount} absent</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mark tab */}
      {activeTab === 'mark' && (
        <>
          {students.length > 0 && !loading && (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <CustomButton text="Mark all Present" variant="secondary" onClick={() => markAll('present')} />
              <CustomButton text="Mark all Absent" variant="secondary" onClick={() => markAll('absent')} />
              <span style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 0.25rem' }} />
              <CustomButton text={saving ? 'Saving…' : 'Save Attendance'} onClick={handleSave} disabled={saving || loading} />
            </div>
          )}
          {departments.length === 0 && !loading ? (
            <div className="empty-state">No departments are assigned to you yet. Please contact an administrator.</div>
          ) : (
            <div className="form-list-container">
              <table className="form-table">
                <thead><tr><th>Roll No</th><th>Name</th><th>Department</th><th>Status</th><th>Record</th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5} className="no-data-cell">Loading…</td></tr>
                    : students.length === 0 ? <tr><td colSpan={5} className="no-data-cell">No PhD scholars found for this selection.</td></tr>
                    : students.map((s) => {
                      const cur = statuses[s.roll_no];
                      return (
                        <tr key={s.roll_no}>
                          <td>{s.roll_no}</td><td>{s.name}</td><td>{s.department_name || s.department_code || '-'}</td>
                          <td>
                            <span style={{ display: 'inline-flex', gap: '1rem', alignItems: 'center' }}>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: cur === 'present' ? 600 : 400 }}>
                                <input type="radio" name={`status-${s.roll_no}`} checked={cur === 'present'} onChange={() => setStatus(s.roll_no, 'present')} /> Present
                              </label>
                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: cur === 'absent' ? 'var(--danger-text)' : undefined, fontWeight: cur === 'absent' ? 600 : 400 }}>
                                <input type="radio" name={`status-${s.roll_no}`} checked={cur === 'absent'} onChange={() => setStatus(s.roll_no, 'absent')} /> Absent
                              </label>
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            {s.recorded ? (s.marked_by_name ? <span title={`Marked by ${s.marked_by_name}`}>by {s.marked_by_name}</span> : <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>Recorded</span>) : <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }} title="No record — treated as no session">No session</span>}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {students.length > 0 && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}><CustomButton text={saving ? 'Saving…' : 'Save Attendance'} onClick={handleSave} disabled={saving || loading} /></div>}
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <div style={{ marginTop: '1rem' }}>
          <div className="attendance-summary-cards">
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Present</span>
              <span className="attendance-summary-value present">{daySummary ? daySummary.present : '—'}</span>
            </div>
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Absent</span>
              <span className="attendance-summary-value absent">{daySummary ? daySummary.absent : '—'}</span>
            </div>
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Not recorded</span>
              <span className="attendance-summary-value">{daySummary ? daySummary.not_recorded : '—'}</span>
            </div>
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Attendance</span>
              <span className="attendance-summary-value">
                {daySummary && daySummary.percent != null ? `${daySummary.percent}%` : '—'}
              </span>
            </div>
            <p className="attendance-summary-caption">
              {daySummary
                ? `${departmentFilter ? (departments.find((d) => String(d.id) === String(departmentFilter))?.name || 'Selected department') : 'All departments'} · ${date} · ${daySummary.scholars} scholar(s) on the roster`
                : 'Loading the day’s figures…'}
            </p>
          </div>
          <div className="form-list-container">
            <table className="form-table">
              <thead><tr><th>Date (not filtered by the date above)</th><th>Total</th><th>Present</th><th>Absent</th><th>Action</th></tr></thead>
              <tbody>
                {historyLoading ? <tr><td colSpan={5} className="no-data-cell">Loading…</td></tr>
                  : history.length === 0 ? <tr><td colSpan={5} className="no-data-cell">No past sessions yet.</td></tr>
                  : history.map((h) => (
                    <tr key={`${h.date}-${h.lecture_id}`}>
                      <td>{h.date?.slice?.(0,10) || h.date}</td><td>{h.total}</td><td style={{ color: 'var(--success-text)' }}>{h.present_count}</td><td style={{ color: 'var(--danger-text)' }}>{h.absent_count}</td>
                      <td><CustomButton text="View" variant="secondary" onClick={() => { setDate(h.date.slice(0,10)); setActiveTab('mark'); }} /></td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {historyTotal > 15 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem', alignItems: 'center' }}>
                <CustomButton text="Prev" variant="secondary" disabled={historyPage <= 1} onClick={() => setHistoryPage((p) => Math.max(1, p-1))} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Page {historyPage} / {historyLastPage}</span>
                <CustomButton text="Next" variant="secondary" disabled={historyPage >= historyLastPage} onClick={() => setHistoryPage((p) => p+1)} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monthly tab */}
      {activeTab === 'monthly' && (
        <div style={{ marginTop: '1rem' }}>
          <div className="attendance-summary-cards">
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Sessions held</span>
              <span className="attendance-summary-value">{monthData ? monthData.days_with_sessions : '—'}</span>
            </div>
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Total present</span>
              <span className="attendance-summary-value present">{monthData ? monthData.totals.present : '—'}</span>
            </div>
            <div className="attendance-summary-card">
              <span className="attendance-summary-label">Total absent</span>
              <span className="attendance-summary-value absent">{monthData ? monthData.totals.absent : '—'}</span>
            </div>
            <p className="attendance-summary-caption">
              {monthData ? `${monthData.label} · per-scholar totals for the month` : 'Loading the month…'}
            </p>
          </div>

          <div className="form-list-container">
            <table className="form-table">
              <thead>
                <tr><th>Roll No</th><th>Name</th><th>Department</th><th>Present</th><th>Absent</th><th>Sessions</th><th>Attendance</th></tr>
              </thead>
              <tbody>
                {monthLoading ? (
                  <tr><td colSpan={7} className="no-data-cell">Loading…</td></tr>
                ) : !monthData || monthData.students.length === 0 ? (
                  <tr><td colSpan={7} className="no-data-cell">No scholars for this selection.</td></tr>
                ) : monthData.students.map((s) => (
                  <tr key={s.roll_no}>
                    <td>{s.roll_no}</td>
                    <td>{s.name}</td>
                    <td>{s.department_name || '—'}</td>
                    <td style={{ color: 'var(--success-text)' }}>{s.present}</td>
                    <td style={{ color: 'var(--danger-text)' }}>{s.absent}</td>
                    <td>{s.total}</td>
                    <td>{s.percent != null ? `${s.percent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Export tab - same filter-bar + form-list-container look as other tabs */}
      {activeTab === 'export' && (
        <div style={{ marginTop: '1rem' }}>
          <div className="filter-bar" style={{ marginBottom: '1rem' }}>
            <div className="filter-row" style={{ alignItems: 'flex-end' }}>
              <div className="input-field-container" style={{ minWidth: '160px' }}>
                <label className="input-label">From</label>
                <DatePicker selected={parseDate(exportFrom)} onChange={(d) => d && setExportFrom(formatDate(d))} dateFormat="yyyy-MM-dd" className="input-field" placeholderText="YYYY-MM-DD" maxDate={todayDate} />
              </div>
              <div className="input-field-container" style={{ minWidth: '160px' }}>
                <label className="input-label">To</label>
                <DatePicker selected={parseDate(exportTo)} onChange={(d) => d && setExportTo(formatDate(d))} dateFormat="yyyy-MM-dd" className="input-field" placeholderText="YYYY-MM-DD" minDate={parseDate(exportFrom)} maxDate={todayDate} />
              </div>
              <div className="input-field-container" style={{ minWidth: '220px' }}>
                <label className="input-label">Department</label>
                <select className="input-field" value={exportDept} onChange={(e) => setExportDept(e.target.value)}>
                  <option value="">All departments</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <CustomButton text="Download CSV" onClick={confirmExport} disabled={exportFrom > exportTo} />
              </div>
            </div>
            {exportFrom > exportTo && <div style={{ marginTop: '0.75rem', background: '#FFF1F2', border: '1px solid #FECDD3', color: '#9F1239', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', fontSize: '0.85rem' }}>From date cannot be after To date.</div>}
          </div>
          <div className="form-list-container">
            <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {exportDept ? `Exports all scholars in ${departments.find((d) => String(d.id) === String(exportDept))?.name || 'the selected department'} for the chosen range.` : 'Exports all scholars you can access for the chosen range.'} Includes present counts per scholar.
            </div>
          </div>
        </div>
      )}

      <CustomModal isOpen={showCsvModal} onClose={() => { setShowCsvModal(false); setCsvFile(null); setCsvPreview(null); }} title="Upload Attendance CSV" width="90vw">
        <div className="modal-form">
          <div className="info-box" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}><strong>CSV Format:</strong></p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', fontFamily: 'monospace', background: '#e0f2fe', padding: '0.5rem', borderRadius: '0.25rem' }}>roll_no,date,status</p>
            <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}><strong>Required:</strong> roll_no, date (YYYY-MM-DD ≤ today, ≥ registration), status (present/absent)</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#92400e' }}>Only roll numbers in your tagged departments are accepted. Clerks can edit only within {EDIT_WINDOW} days.</p>
          </div>
          <div style={{ marginBottom: '1rem' }}><CustomButton text="Download Template" onClick={downloadTemplate} style={{ backgroundColor: '#FF9800', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: '500', marginBottom: '1rem' }} /></div>
          <input type="file" accept=".csv" onChange={handleFileChange} style={{ padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '1rem', cursor: 'pointer', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }} />
          {csvPreview && (
            <div style={{ marginTop: '1rem', marginBottom: '1rem', maxHeight: '400px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)' }}>
              <div style={{ padding: '0.75rem', background: '#f9fafb', borderBottom: '1px solid var(--border-color)', fontWeight: '600' }}>Preview: {csvPreview.total} row(s) found — showing 5</div>
              <div className="csv-preview-wrap"><table className="csv-preview"><thead><tr><th>Row</th>{csvPreview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{csvPreview.data.map(r => <tr key={r._row}><td className="csv-rownum">{r._row}</td>{csvPreview.headers.map(h => <td key={h}>{r[h] || <span style={{ color:'var(--text-subtle)', fontStyle:'italic' }}>empty</span>}</td>)}</tr>)}</tbody></table></div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => { setShowCsvModal(false); setCsvFile(null); setCsvPreview(null); }} style={{ padding: '0.75rem 1.5rem', background: 'white', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCsvUpload} disabled={uploading || !csvFile} style={{ padding: '0.75rem 1.5rem', background: uploading || !csvFile ? 'var(--text-subtle)' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: 'var(--radius)', fontSize: '1rem', fontWeight: '500', cursor: uploading || !csvFile ? 'not-allowed' : 'pointer' }}>{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </div>
      </CustomModal>
    </Layout>
  );
};
export default AttendancePage;
