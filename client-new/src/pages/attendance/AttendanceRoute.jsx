import React from 'react';
import AttendancePage from './AttendancePage';
import StudentAttendancePage from './StudentAttendancePage';
import HodAttendancePage from './HodAttendancePage';

/**
 * /attendance means something different per role, and a notification link is the
 * same URL for the scholar and the HOD who read it. Dispatching here keeps that
 * one link working for everyone.
 */
const AttendanceRoute = () => {
  const role = localStorage.getItem('userRole');

  if (role === 'student') return <StudentAttendancePage />;
  if (role === 'hod') return <HodAttendancePage />;

  return <AttendancePage />;
};

export default AttendanceRoute;
