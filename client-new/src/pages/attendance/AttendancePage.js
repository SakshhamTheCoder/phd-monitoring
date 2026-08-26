import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import PageHeader from '../../components/pageHeader/PageHeader';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';

const todayString = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
};

const AttendancePage = () => {
  const [date, setDate] = useState(todayString());
  const [departments, setDepartments] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [students, setStudents] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  return (
    <Layout>
      <PageHeader
        title="Attendance"
        subtitle={departments.length > 0 ? `${departments.map((d) => d.name).join(', ')} — select Absent scholars and save.` : 'Your departments will appear here once an admin tags you.'}
        actions={
          students.length > 0 && (
            <CustomButton
              text={saving ? 'Saving…' : 'Save Attendance'}
              onClick={handleSave}
              disabled={saving || loading}
            />
          )
        }
      />

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
    </Layout>
  );
};

export default AttendancePage;
