// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

// The URF project the page is asked for. Each test sets the stage its form has
// reached, which is the whole of what decides whether the form is filled in or
// read.
let application;

const project = (overrides = {}) => ({
  id: 1,
  session: 2026,
  status: 'selected',
  stage: 'complete',
  project_title: 'Lock project',
  student1_email: 'one@thapar.edu',
  fellows: [],
  reports: [],
  ...overrides,
});

vi.mock('../../components/dashboard/layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/pageHeader/PageHeader', () => ({ default: () => null }));
vi.mock('../../components/forms/formGrid/FormGrid', () => ({ default: () => null }));
vi.mock('../../components/forms/fields/CustomButton', () => ({ default: () => null }));
vi.mock('../../components/urf/UrfApproval', () => ({ UrfApprovalTrail: () => null }));
vi.mock('../../components/urf/UrfRecord', () => ({
  StatusText: () => null,
  REPORT_TYPES: { half_yearly: 'Half-yearly Progress Report', final: 'Final Report' },
}));
// The read-only page a PhD form is read on. It names the form it was handed, so
// the test can tell which submission the page sent it to.
vi.mock('../../components/urf/UrfFormShell', () => ({
  default: ({ path }) => <div data-testid="shell">{path}</div>,
}));
vi.mock('../../components/urf/UrfForms', () => ({
  ApplyForm: () => <div data-testid="apply-form" />,
  FellowForm: () => <div data-testid="fellow-form" />,
  ReportForm: () => <div data-testid="report-form" />,
  signedInUser: () => ({ email: 'one@thapar.edu' }),
}));
vi.mock('../../api/urf', () => ({
  apiUrfMine: () => Promise.resolve({
    success: true,
    response: {
      applications_open: true,
      session: 2026,
      student: {},
      report_windows: [{ type: 'half_yearly', session: 2026, is_open: true, opens_on: '2026-01-01', closes_on: '2026-12-31' }],
      applications: [application],
    },
  }),
}));

const { UrfFormPage } = await import('./UrfStudentForms');

const show = async (type) => {
  render(
    <MemoryRouter initialEntries={['/forms/urf/1/form']}>
      <Routes>
        <Route path="/forms/urf/:id/form" element={<UrfFormPage type={type} />} />
      </Routes>
    </MemoryRouter>,
  );
  await waitFor(() => expect(document.querySelector('[data-testid]')).not.toBeNull());
};

const shellPath = () => screen.getByTestId('shell').textContent;

beforeEach(() => { application = project(); });
afterEach(cleanup);

describe('a URF form the student has submitted', () => {
  it('is read rather than filled in once the application is with the mentor', async () => {
    application = project({ status: 'applied', stage: 'mentor' });
    await show('application');

    expect(shellPath()).toBe('/urf/urf-application/1');
    expect(screen.queryByTestId('apply-form')).toBeNull();
  });

  it('is filled in again once a step sends the application back', async () => {
    application = project({ status: 'applied', stage: 'student' });
    await show('application');

    expect(screen.queryByTestId('apply-form')).not.toBeNull();
    expect(screen.queryByTestId('shell')).toBeNull();
  });

  it('reads the submitted stipend details on their own page', async () => {
    application = project({ fellows: [{ id: 7, stage: 'adordc' }] });
    await show('additional');

    expect(shellPath()).toBe('/urf/urf-additional-info/7');
    expect(screen.queryByTestId('fellow-form')).toBeNull();
  });

  it('offers the stipend form again once it is sent back', async () => {
    application = project({ fellows: [{ id: 7, stage: 'student' }] });
    await show('additional');

    expect(screen.queryByTestId('fellow-form')).not.toBeNull();
  });

  it('reads a filed report rather than offering the round again', async () => {
    application = project({ reports: [{ id: 9, type: 'half_yearly', stage: 'mentor' }] });
    await show('half_yearly');

    // The round is still open, so without the lock the form came back and a
    // second submit filed a duplicate beside the first.
    expect(shellPath()).toBe('/urf/urf-half-yearly-report/9');
    expect(screen.queryByTestId('report-form')).toBeNull();
  });

  it('offers the round while nothing has been filed', async () => {
    await show('half_yearly');

    expect(screen.queryByTestId('report-form')).not.toBeNull();
  });
});
