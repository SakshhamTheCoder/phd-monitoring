import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import Tabs from '../../components/tabs/Tabs';
import { baseURL } from '../../api/urls';
import { customFetch } from '../../api/base';
import { parseAttendanceQuery } from '../../utils/leaveBalance';
import './AttendancePage.css';

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
  const [loading, setLoading] = useState(false);
  const [rollNo, setRollNo] = useState(null);

  // localStorage holds no roll_no for a scholar. Read it the same way
  // ProfileCard does — GET /students with no id resolves to the caller's own
  // record. See client-new/src/components/profileCard/ProfileCard.jsx:45.
  useEffect(() => {
    customFetch(`${baseURL}/students`, 'GET', {}, true, false).then((res) => {
      if (res?.success) setRollNo(res.response.data?.[0]?.roll_no ?? null);
    });
  }, []);

  useEffect(() => {
    if (!rollNo) return;
    setLoading(true);
    customFetch(`${baseURL}/clerks/attendance/student/${rollNo}`, 'GET', {}, true)
      .then((res) => { if (res?.success) setData(res.response); })
      .finally(() => setLoading(false));
  }, [rollNo]);

  // Monthly: group the scholar's own records by YYYY-MM and count each bucket.
  const months = useMemo(() => {
    const out = {};
    for (const r of (data?.records || [])) {
      const key = String(r.date).slice(0, 7);
      out[key] ??= { month: key, present: 0, absent: 0, total: 0 };
      if (r.status === 'present' || r.status === 'absent') out[key][r.status] += 1;
      out[key].total += 1;
    }
    return Object.values(out).sort((a, b) => b.month.localeCompare(a.month));
  }, [data]);

  const records = data?.records || [];

  return (
    <Layout>
      <h1 className="page-title">My Attendance</h1>

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
              {data.summary.percent != null ? `${data.summary.percent}%` : '—'}
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
              ) : months.length === 0 ? (
                <tr><td colSpan={5} className="no-data-cell">No attendance recorded yet.</td></tr>
              ) : months.map((m) => (
                <tr key={m.month}>
                  <td>{m.month}</td>
                  <td style={{ color: 'var(--success-text)' }}>{m.present}</td>
                  <td style={{ color: 'var(--danger-text)' }}>{m.absent}</td>
                  <td>{m.total}</td>
                  <td>{m.total ? `${Math.round((m.present / m.total) * 100)}%` : '—'}</td>
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
              ) : records.length === 0 ? (
                <tr><td colSpan={3} className="no-data-cell">No sessions recorded yet.</td></tr>
              ) : records.map((r) => (
                <tr key={`${r.date}-${r.lecture_id}`}>
                  <td>{r.date}</td>
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
        <div className="form-list-container" style={{ marginTop: '1rem' }}>
          <div className="no-data-cell" style={{ padding: '1.5rem' }}>Leave applications will appear here.</div>
        </div>
      )}
    </Layout>
  );
};

export default StudentAttendancePage;
