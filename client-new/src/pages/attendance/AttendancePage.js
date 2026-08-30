import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
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
  const [date, setDate] = useState(todayString());
  const [departments, setDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFrom, setExportFrom] = useState(todayString());
  const [exportTo, setExportTo] = useState(todayString());

  const role = localStorage.getItem('userRole');
  const isAdmin = role === 'admin';

  useEffect(() => {
    if (isAdmin) {
      customFetch(baseURL + '/departments', 'GET', {}, false)
        .then((res) => {
          const deps = res.response?.data || res.response?.departments || res.response || [];
          const list = Array.isArray(deps) ? deps : [];
          // department list shape varies: {data:[{id,name}]} or [{id,name}]
          const normalized = list.map((d) => ({ id: d.id, name: d.name, code: d.code }));
          if (normalized.length > 0) {
            setDepartments(normalized);
            setDepartmentFilter(String(normalized[0].id));
          }
        })
        .catch(() => {});
    } else {
      customFetch(baseURL + '/clerks/my-departments', 'GET', {}, false)
        .then((res) => {
          if (res.success) {
            const deps = res.response.departments || [];
            setDepartments(deps);
            if (deps.length > 0) setDepartmentFilter(String(deps[0].id));
          }
        })
        .catch(() => {});
    }
  }, [isAdmin]);

  const loadRoster = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance?${params.toString()}`, 'GET', {}, true);
    setLoading(false);
    if (!res.success) return;

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

  useEffect(() => { loadRoster(); }, [loadRoster]);

  const setStatus = (rollNo, status) => {
    setStatuses((prev) => ({ ...prev, [rollNo]: status }));
  };

  const markAll = (status) => {
    const next = {};
    students.forEach((s) => { next[s.roll_no] = status; });
    setStatuses(next);
  };

  const absentCount = useMemo(
    () => students.filter((s) => statuses[s.roll_no] === 'absent').length,
    [students, statuses]
  );

  const handleSave = async () => {
    if (students.length === 0) return;
    if (!departmentFilter) {
      toast.error('Select a department first');
      return;
    }
    const records = students
      .filter((s) => statuses[s.roll_no] === 'present' || statuses[s.roll_no] === 'absent')
      .map((s) => ({ roll_no: s.roll_no, status: statuses[s.roll_no] }));
    if (records.length === 0) {
      toast.info('No attendance marked — treated as no session (nothing saved)');
      return;
    }
    if (records.length < students.length) {
      const skipped = students.length - records.length;
      toast.info(`${skipped} unmarked scholar(s) will be left as no session`);
    }
    setSaving(true);
    const res = await customFetch(baseURL + '/clerks/attendance', 'POST', { date, records }, true);
    setSaving(false);
    if (res.success) {
      toast.success(res.response.message || 'Attendance saved');
      loadRoster();
    }
  };

  const downloadTemplate = async () => {
    const token = localStorage.getItem('token');
    const res = await fetch(baseURL + '/clerks/attendance/template', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'attendance_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportClick = () => {
    setExportFrom(date);
    setExportTo(date);
    setShowExportModal(true);
  };

  const confirmExport = async () => {
    if (exportFrom > exportTo) {
      toast.error('From date cannot be after To date');
      return;
    }
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ from: exportFrom, to: exportTo });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await fetch(baseURL + `/clerks/attendance/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { toast.error('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance_${exportFrom}_to_${exportTo}.csv`; a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
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
    const form = new FormData();
    form.append('file', csvFile);
    const token = localStorage.getItem('token');
    try {
      const res = await fetch(baseURL + '/clerks/attendance/csv', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || 'CSV imported');
        if (data.data?.errors?.length) toast.warning(`${data.data.error_count} rows had errors — check console`);
        console.log('CSV import errors', data.data?.errors);
        setShowCsvModal(false); setCsvFile(null); setCsvPreview(null);
        loadRoster();
      } else {
        toast.error(data.message || 'Import failed');
      }
    } catch (e) {
      toast.error('Upload failed: ' + e.message);
    } finally { setUploading(false); }
  };

  const todayDate = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const minSelectableDate = useMemo(() => {
    if (isAdmin) return null;
    const d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - EDIT_WINDOW);
    return d;
  }, [isAdmin]);

  return (
    <Layout>
      <PageHeader
        title="Attendance"
        subtitle={departments.length > 0 ? `${departments.map((d) => d.name).join(', ')} — select Absent scholars and save.` : 'Your departments will appear here once an admin tags you.'}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <CustomButton text="Upload CSV" variant="secondary" onClick={() => setShowCsvModal(true)} />
            <CustomButton text="Export" variant="secondary" onClick={handleExportClick} />
          </div>
        }
      />



      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          <div className="input-field-container" style={{ minWidth: '180px' }}>
            <label className="input-label">
              Date
              {date === todayString() && <span className="badge badge--success" style={{ marginLeft: '0.5rem', fontSize: '0.65rem' }}>Today</span>}
            </label>
            <DatePicker
              selected={parseDate(date)}
              onChange={(d) => d && setDate(formatDate(d))}
              dateFormat="yyyy-MM-dd"
              className="input-field"
              placeholderText="YYYY-MM-DD"
              minDate={minSelectableDate}
              maxDate={todayDate}
            />
          </div>
          {departments.length > 0 && (
            <div className="input-field-container" style={{ minWidth: '220px' }}>
              <label className="input-label">Department</label>
              <select
                className="input-field"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            <span>{students.length} scholar(s)</span>
            <span className="badge badge--danger">{absentCount} absent</span>
          </div>
        </div>
      </div>

      {students.length > 0 && !loading && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <CustomButton text="Mark all Present" variant="secondary" onClick={() => markAll('present')} />
          <CustomButton text="Mark all Absent" variant="secondary" onClick={() => markAll('absent')} />
          <span style={{ width: '1px', height: '24px', background: 'var(--border-subtle)', margin: '0 0.25rem' }} />
          <CustomButton text={saving ? 'Saving…' : 'Save Attendance'} onClick={handleSave} disabled={saving || loading} />
        </div>
      )}

      {departments.length === 0 && !loading ? (
        <div className="empty-state">
          No departments are assigned to you yet. Please contact an administrator.
        </div>
      ) : (
        <div className="form-list-container">
          <table className="form-table">
            <thead>
              <tr>
                <th>Roll No</th>
                <th>Name</th>
                <th>Department</th>
                <th>Status</th>
                <th>Record</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="no-data-cell">Loading…</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={5} className="no-data-cell">No PhD scholars found for this selection.</td></tr>
              ) : (
                students.map((s) => {
                  const cur = statuses[s.roll_no];
                  return (
                  <tr key={s.roll_no}>
                    <td>{s.roll_no}</td>
                    <td>{s.name}</td>
                    <td>{s.department_name || s.department_code || '-'}</td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: '1rem', alignItems: 'center' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontWeight: cur === 'present' ? 600 : 400 }}>
                          <input
                            type="radio"
                            name={`status-${s.roll_no}`}
                            checked={cur === 'present'}
                            onChange={() => setStatus(s.roll_no, 'present')}
                          />
                          Present
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: cur === 'absent' ? 'var(--danger-text)' : undefined, fontWeight: cur === 'absent' ? 600 : 400 }}>
                          <input
                            type="radio"
                            name={`status-${s.roll_no}`}
                            checked={cur === 'absent'}
                            onChange={() => setStatus(s.roll_no, 'absent')}
                          />
                          Absent
                        </label>
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      {s.recorded ? (
                        s.marked_by_name ? <span title={`Marked by ${s.marked_by_name}`}>by {s.marked_by_name}</span> : <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>Recorded</span>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }} title="No record — treated as no session">No session</span>
                      )}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
          {students.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <CustomButton
                text={saving ? 'Saving…' : 'Save Attendance'}
                onClick={handleSave}
                disabled={saving || loading}
              />
            </div>
          )}
        </div>
      )}

      <CustomModal isOpen={showExportModal} onClose={() => setShowExportModal(false)} title="Export Attendance" width="600px" minHeight="420px">
        <div className="modal-form">
          <div className="field-stack">
            <div className="input-field-container">
              <label className="input-label">From</label>
              <DatePicker
                selected={parseDate(exportFrom)}
                onChange={(d) => d && setExportFrom(formatDate(d))}
                dateFormat="yyyy-MM-dd"
                className="input-field"
                placeholderText="YYYY-MM-DD"
                maxDate={todayDate}
              />
            </div>
            <div className="input-field-container">
              <label className="input-label">To</label>
              <DatePicker
                selected={parseDate(exportTo)}
                onChange={(d) => d && setExportTo(formatDate(d))}
                dateFormat="yyyy-MM-dd"
                className="input-field"
                placeholderText="YYYY-MM-DD"
                minDate={parseDate(exportFrom)}
                maxDate={todayDate}
              />
            </div>
          </div>
          {exportFrom > exportTo && (
            <div className="modal-note" style={{ marginTop: '1rem', background: '#FFF1F2', borderColor: '#FECDD3', color: '#9F1239' }}>
              From date cannot be after To date.
            </div>
          )}
          <div className="modal-actions">
            <CustomButton text="Cancel" variant="secondary" onClick={() => setShowExportModal(false)} />
            <CustomButton text="Export" onClick={confirmExport} disabled={exportFrom > exportTo} />
          </div>
        </div>
      </CustomModal>

      <CustomModal isOpen={showCsvModal} onClose={() => { setShowCsvModal(false); setCsvFile(null); setCsvPreview(null); }} title="Upload Attendance CSV" width="90vw">
        <div className="modal-form">
          <div className="info-box" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}><strong>CSV Format:</strong></p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', fontFamily: 'monospace', background: '#e0f2fe', padding: '0.5rem', borderRadius: '0.25rem' }}>roll_no,date,status</p>
            <p style={{ margin: '0.5rem 0 0.25rem 0', fontSize: '0.875rem' }}><strong>Required:</strong> roll_no, date (YYYY-MM-DD ≤ today, ≥ registration), status (present/absent)</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}><strong>Optional:</strong> lecture_id — leave empty for daily attendance</p>
            <p style={{ margin: '0.25rem 0', fontSize: '0.875rem', color: '#92400e' }}>Only roll numbers in your tagged departments are accepted. Clerks can edit only within {EDIT_WINDOW} days.</p>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <CustomButton text="Download Template" onClick={downloadTemplate} style={{ backgroundColor: '#FF9800', color: 'white', padding: '10px 20px', borderRadius: '6px', fontWeight: '500', marginBottom: '1rem' }} />
          </div>
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
