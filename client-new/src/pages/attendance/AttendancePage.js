import React, { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/dashboard/layout';
import { toast } from 'react-toastify';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import CustomButton from '../../components/forms/fields/CustomButton';
import './AttendancePage.css';

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

  // Departments the clerk covers, shown once so the page is not a bare table
  // when no departments have been tagged yet.
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
    // Every student starts present; saved attendance for the day overrides.
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
      <div className="attendance-page">
        <div className="attendance-controls">
          <div className="control-group">
            <label htmlFor="attendance-date">Date</label>
            <input
              id="attendance-date"
              type="date"
              value={date}
              max={todayString()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          {departments.length > 1 && (
            <div className="control-group">
              <label htmlFor="attendance-dept">Department</label>
              <select
                id="attendance-dept"
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
          <div className="attendance-summary">
            <span>{students.length} scholar(s)</span>
            <span className="absent-count">{absentCount} absent</span>
          </div>
        </div>

        {departments.length === 0 && !loading ? (
          <div className="attendance-empty">
            No departments are assigned to you yet. Please contact an administrator.
          </div>
        ) : (
          <>
            <div className="attendance-table-wrap">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Name</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={3} className="attendance-loading">Loading…</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan={3} className="attendance-loading">No PhD scholars found for this date&apos;s selection.</td></tr>
                  ) : (
                    students.map((s) => (
                      <tr key={s.roll_no} className={statuses[s.roll_no] === 'absent' ? 'row-absent' : ''}>
                        <td>{s.roll_no}</td>
                        <td>{s.name}</td>
                        <td>
                          <label className="radio-option">
                            <input
                              type="radio"
                              name={`status-${s.roll_no}`}
                              checked={(statuses[s.roll_no] || 'present') === 'present'}
                              onChange={() => setStatus(s.roll_no, 'present')}
                            />
                            Present
                          </label>
                          <label className="radio-option radio-absent">
                            <input
                              type="radio"
                              name={`status-${s.roll_no}`}
                              checked={statuses[s.roll_no] === 'absent'}
                              onChange={() => setStatus(s.roll_no, 'absent')}
                            />
                            Absent
                          </label>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="attendance-actions">
              <CustomButton
                text={saving ? 'Saving…' : 'Save Attendance'}
                onClick={handleSave}
                disabled={saving || loading || students.length === 0}
              />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default AttendancePage;
