// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, cleanup, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LoadingProvider } from '../../context/LoadingContext';

vi.mock('../../api/leave', () => ({
  apiLeaveList: vi.fn(),
  apiLeaveLoad: vi.fn(),
  apiLeaveBalance: vi.fn(() => Promise.resolve({ success: false })),
  apiLeaveSubmit: vi.fn(),
}));

vi.mock('../../api/base', () => ({
  customFetch: vi.fn(() => Promise.resolve({ success: false })),
  isNetworkError: () => false,
  NETWORK_ERROR_MESSAGE: '',
}));

import { apiLeaveList, apiLeaveLoad } from '../../api/leave';
import LeaveRequests from './LeaveRequests';

const rows = [
  { id: 1, name: 'Scholar One', roll_no: 101, department: 'CSED', department_id: 7, leave_type: 'casual', from_date: '2026-09-14', to_date: '2026-09-14', day_part: 'full', status: 'pending', stage: 'hod' },
  { id: 2, name: 'Scholar Two', roll_no: 202, department: 'MED', department_id: 11, leave_type: 'academic', from_date: '2026-09-15', to_date: '2026-09-16', day_part: 'full', status: 'approved', stage: 'complete' },
  { id: 3, name: 'Draft Only', roll_no: 303, department: 'MED', department_id: 11, leave_type: null, from_date: null, to_date: null, day_part: null, status: 'draft', stage: 'student' },
];

/** The payload loadForm returns, as read by `role`. */
const application = (role) => ({
  form_id: 1,
  name: 'Scholar One',
  roll_no: 101,
  department: 'CSED',
  role,
  stage: 'hod',
  status: 'pending',
  leave_type: 'casual',
  from_date: '2026-09-14',
  to_date: '2026-09-14',
  day_part: 'full',
  reason: 'Personal',
  steps: ['student', 'hod', 'complete'],
  history: [],
  locks: { student: true, hod: false },
  approvals: { hod: null },
  comments: { hod: null },
});

const renderAs = (role, props = {}) => {
  localStorage.setItem('userRole', role);
  return render(
    <MemoryRouter>
      <LoadingProvider>
        <LeaveRequests {...props} />
      </LoadingProvider>
    </MemoryRouter>
  );
};

beforeEach(() => {
  apiLeaveList.mockResolvedValue({ success: true, response: { data: rows } });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.clearAllMocks();
});

describe('LeaveRequests', () => {
  it('shows an admin every department, says which, and leaves out drafts', async () => {
    renderAs('admin', { showDepartment: true });

    expect(await screen.findByText('Scholar One')).toBeTruthy();
    expect(screen.getByText('Scholar Two')).toBeTruthy();
    expect(screen.queryByText('Draft Only')).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Department' })).toBeTruthy();
    expect(screen.getByText('CSED')).toBeTruthy();
  });

  it('narrows to the department picked in the filter', async () => {
    renderAs('admin', { showDepartment: true, departmentId: '11' });

    expect(await screen.findByText('Scholar Two')).toBeTruthy();
    expect(screen.queryByText('Scholar One')).toBeNull();
  });

  it('lets an admin read an application without being able to decide it', async () => {
    apiLeaveLoad.mockResolvedValue({ success: true, response: application('admin') });
    renderAs('admin', { showDepartment: true });

    fireEvent.click(await screen.findByText('Scholar One'));
    expect(await screen.findByText('Leave Application')).toBeTruthy();

    // Recommendation renders unlocked and locks in an effect once it knows who
    // is reading, so the settled form is the one to judge. Waiting for the
    // button to go, rather than asserting on the first frame, is what tells a
    // one-frame flash apart from an admin who can really press Submit.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Submit' })).toBeNull());
  });

  it('still gives the HOD the decision, and no department column', async () => {
    apiLeaveLoad.mockResolvedValue({ success: true, response: application('hod') });
    renderAs('hod');

    fireEvent.click(await screen.findByText('Scholar One'));

    expect(await screen.findByRole('button', { name: 'Submit' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Department' })).toBeNull();
  });
});
