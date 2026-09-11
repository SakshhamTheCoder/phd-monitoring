import React from 'react';
import Layout from '../../components/dashboard/layout';
import Tabs from '../../components/tabs/Tabs';
import LeaveRequests from './LeaveRequests';

/**
 * The HOD's review of their department's leave applications (spec 5.3).
 *
 * The list and the review live in LeaveRequests, which the admin's attendance
 * page also shows. The server scopes what comes back to the HOD's own
 * department, so there is nothing to filter and no department column here.
 */
const HodAttendancePage = () => (
  <Layout>
    <h1 className="page-title">Attendance</h1>

    <Tabs
      value="leaves"
      onChange={() => {}}
      items={[{ value: 'leaves', label: 'Leave Requests' }]}
    />

    <LeaveRequests />
  </Layout>
);

export default HodAttendancePage;
