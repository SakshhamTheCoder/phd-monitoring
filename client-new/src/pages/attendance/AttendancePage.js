import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';
import CustomModal from '../../components/forms/modal/CustomModal';

const todayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

const EDIT_WINDOW = 7;

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

  useEffect(() => {
    customFetch(baseURL + '/clerks/my-departments', 'GET', {}, false)
      .then((res) => {
        if (res.success) setDepartments(res.response.departments || []);
      })
      .catch(() => {});
  }, []);

  const loadRoster = async () => {
    setLoading(true);
    const params = new URLSearchParams({ date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await customFetch(baseURL + `/clerks/attendance?${params.toString()}`, 'GET', {}, true);
    setLoading(false);
    if (!res.success) return;

    const list = res.response.students || [];
    setStudents(list);
    const next = {};
    list.forEach((s) => { next[s.roll_no] = s.status || 'present'; });
    setStatuses(next);
  };

  useEffect(() => { loadRoster(); /* eslint-disable-next-line */ }, [date, departmentFilter]);

  const setStatus = (rollNo, status) => {
    setStatuses((prev) => ({ ...prev, [rollNo]: status }));
  };

  const absentCount = useMemo(
    () => students.filter((s) => statuses[s.roll_no] === 'absent').length,
    [students, statuses]
  );

  const isPastWindow = useMemo(() => {
    const d = new Date(date);
    const today = new Date(todayString());
    const diff = (today - d) / (1000*60*60*24);
    return diff > EDIT_WINDOW;
  }, [date]);

  const handleSave = async () => {
    if (students.length === 0) return;
    setSaving(true);
    const records = students.map((s) => ({ roll_no: s.roll_no, status: statuses[s.roll_no] || 'present' }));
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

  const handleExport = async () => {
    const token = localStorage.getItem('token');
    const params = new URLSearchParams({ from: date, to: date });
    if (departmentFilter) params.set('department_id', departmentFilter);
    const res = await fetch(baseURL + `/clerks/attendance/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) { toast.error('Export failed'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance_${date}.csv`; a.click();
    URL.revokeObjectURL(url);
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

  return (
    <Layout>
      <PageHeader
        title="Attendance"
        subtitle={departments.length > 0 ? `${departments.map((d) => d.name).join(', ')} — select Absent scholars and save.` : 'Your departments will appear here once an admin tags you.'}
        actions={
          <div style={{ display: 'flex', gap: '10px' }}>
            <CustomButton text="Upload CSV" variant="secondary" onClick={() => setShowCsvModal(true)} />
            <CustomButton text="Export" variant="secondary" onClick={handleExport} />
            {students.length > 0 && (
              <CustomButton
                text={saving ? 'Saving…' : 'Save Attendance'}
                onClick={handleSave}
                disabled={saving || loading}
              />
            )}
          </div>
        }
      />

      {isPastWindow && (
        <div className="modal-note" style={{ marginBottom: '1rem' }}>
          This date is older than {EDIT_WINDOW} days. Clerks cannot edit beyond the window — contact an admin for older records. Edits keep <code>updated_at</code>/<code>marked_by</code> and are logged to history.
        </div>
      )}

      <div className="filter-bar" style={{ marginBottom: '1rem' }}>
        <div className="filter-row" style={{ alignItems: 'flex-end' }}>
          <div className="input-field-container" style={{ minWidth: '180px' }}>
            <label className="input-label">Date</label>
            <input
              className="input-field"
              type="date"
              value={date}
              max={todayString()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {departments.length > 1 && (
            <div className="input-field-container" style={{ minWidth: '220px' }}>
              <label className="input-label">Department</label>
              <select
                className="input-field"
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
              >
                <option value="">All my departments</option>
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
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} className="no-data-cell">Loading…</td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={4} className="no-data-cell">No PhD scholars found for this selection.</td></tr>
              ) : (
                students.map((s) => (
                  <tr key={s.roll_no}>
                    <td>{s.roll_no}</td>
                    <td>{s.name}</td>
                    <td><span className="badge badge--neutral">{s.department_name || s.department_code || '-'}</span></td>
                    <td>
                      <span style={{ display: 'inline-flex', gap: '1rem' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name={`status-${s.roll_no}`}
                            checked={(statuses[s.roll_no] || 'present') === 'present'}
                            onChange={() => setStatus(s.roll_no, 'present')}
                          />
                          Present
                        </label>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', color: statuses[s.roll_no] === 'absent' ? 'var(--danger-text)' : undefined, fontWeight: statuses[s.roll_no] === 'absent' ? 600 : 400 }}>
                          <input
                            type="radio"
                            name={`status-${s.roll_no}`}
                            checked={statuses[s.roll_no] === 'absent'}
                            onChange={() => setStatus(s.roll_no, 'absent')}
                          />
                          Absent
                        </label>
                      </span>
                    </td>
                  </tr>
                ))
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
          <input type="file" accept=".csv" onChange={handleFileChange} style={{ padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', cursor: 'pointer', marginBottom: '1rem', width: '100%', boxSizing: 'border-box' }} />
          {csvPreview && (
            <div style={{ marginTop: '1rem', marginBottom: '1rem', maxHeight: '400px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '0.5rem' }}>
              <div style={{ padding: '0.75rem', background: '#f9fafb', borderBottom: '1px solid #d1d5db', fontWeight: '600' }}>Preview: {csvPreview.total} row(s) found — showing 5</div>
              <div className="csv-preview-wrap"><table className="csv-preview"><thead><tr><th>Row</th>{csvPreview.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{csvPreview.data.map(r => <tr key={r._row}><td className="csv-rownum">{r._row}</td>{csvPreview.headers.map(h => <td key={h}>{r[h] || <span style={{ color:'#9ca3af', fontStyle:'italic' }}>empty</span>}</td>)}</tr>)}</tbody></table></div>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1rem' }}>
            <button onClick={() => { setShowCsvModal(false); setCsvFile(null); setCsvPreview(null); }} style={{ padding: '0.75rem 1.5rem', background: 'white', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '500', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleCsvUpload} disabled={uploading || !csvFile} style={{ padding: '0.75rem 1.5rem', background: uploading || !csvFile ? '#9ca3af' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '500', cursor: uploading || !csvFile ? 'not-allowed' : 'pointer' }}>{uploading ? 'Uploading...' : 'Upload'}</button>
          </div>
        </div>
      </CustomModal>
    </Layout>
  );
};

export default AttendancePage;
