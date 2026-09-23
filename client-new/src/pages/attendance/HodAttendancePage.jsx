import React from 'react';
import LeaveRequests from './LeaveRequests';

/**
 * The HOD's review of their department's leave applications (spec 5.3).
 *
 * The list and the review live in LeaveRequests, which the admin's attendance
 * page also shows. The server scopes what comes back to the HOD's own
 * department, so there is nothing to filter and no department column here.
 */
const HodAttendancePage = () => (
  <>
    <h1 className="page-title">Attendance</h1>

    <LeaveRequests />
  </>
);

export default HodAttendancePage;
