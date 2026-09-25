// @vitest-environment jsdom
import React from 'react';
import { render, screen, within, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

// The page is the PhD form shell over a URF form, so the test reads it the way
// a person does: the title bar, the status view, and one panel per step of the
// chain up to the reader's own.
const fetched = [];
vi.mock('../../components/dashboard/layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../context/LoadingContext', () => ({ useLoading: () => ({ setLoading: () => {} }) }));
vi.mock('../../api/base', () => ({
  customFetch: (url) => {
    fetched.push(url);
    return Promise.resolve({ success: true, response: payload });
  },
  isNetworkError: () => false,
  NETWORK_ERROR_MESSAGE: 'offline',
}));

let payload;

const UrfFormRecord = (await import('./UrfFormRecord')).default;

afterEach(() => {
  cleanup();
  fetched.length = 0;
});

const STEPS = ['student', 'mentor', 'adordc', 'dordc', 'complete'];

const formAt = (stage, role) => ({
  form: 'urf-application',
  form_id: 12,
  form_name: 'URF Application Form',
  project_title: 'Soil sensors',
  session: 2026,
  stage,
  role,
  steps: STEPS,
  current_step: STEPS.indexOf(stage),
  comments: { student: null, mentor: 'Worth doing.', adordc: null, dordc: null },
  approvals: { mentor: true, adordc: false, dordc: false },
  locks: { student: true, mentor: true, adordc: false, dordc: false, complete: false },
  history: [{ timestamp: '2026-09-15T10:00:00+05:30', action: 'Submitted by Asha Rao (the student)', comment: null }],
  awaiting_me: stage === role,
  may_reject: false,
  // As App\Forms\UrfFormDefinition describes it.
  view: {
    version: 1,
    title: 'URF Application Form',
    notes: ['URF 2026 · Soil sensors'],
    notices: [],
    panels: {
      student: { wrapped: true, rows: [{ kind: 'grid', items: [{ type: 'text', label: 'Title of Project', value: 'Soil sensors', locked: true }] }] },
    },
    step_options: Object.fromEntries(['mentor', 'adordc', 'dordc'].map((step) => [step, {
      allow_rejection: false,
      submit_path: '/urf/urf-application/12/decision',
    }])),
  },
});

// The panels name their step from an effect, so the assertions on them wait
// for it rather than reading the first render.
const renderPage = async (formData) => {
  payload = formData;
  render(
    <MemoryRouter initialEntries={['/urf/urf-application/12']}>
      <Routes>
        <Route path="/urf/:form/:id" element={<UrfFormRecord />} />
      </Routes>
    </MemoryRouter>
  );
  await screen.findByText('URF Application Form');
};

describe('UrfFormRecord', () => {
  it('reads the form from the page it is on, and names it in the title bar', async () => {
    await renderPage(formAt('adordc', 'adordc'));

    expect(fetched[0]).toMatch(/\/urf\/urf-application\/12$/);
    expect(screen.getByText('Form ID: 12')).toBeTruthy();
    expect(screen.getByText('Stage: ADORDC')).toBeTruthy();
    expect(screen.getByText('View status')).toBeTruthy();
  });

  it('shows the chain and the history behind View Status', async () => {
    await renderPage(formAt('adordc', 'adordc'));
    screen.getByText('View status').click();

    // The form's own sections carry the step names too, so look in the dialog.
    const status = within((await screen.findByText('Form status')).parentElement);
    // The mentor step is a URF one and has to be named, not left as "mentor".
    expect(status.getByText('Faculty Mentor')).toBeTruthy();
    expect(status.getByText('DORDC')).toBeTruthy();
    expect(status.getByText('Submitted by Asha Rao (the student)')).toBeTruthy();
  });

  it('shows a reader what was filled in and the steps up to their own', async () => {
    await renderPage(formAt('adordc', 'mentor'));

    // What the student filed, locked, from the server's description.
    expect(screen.getByDisplayValue('Soil sensors')).toBeTruthy();
    expect(screen.getByText('URF 2026 · Soil sensors')).toBeTruthy();
    await screen.findByText('Recommendation of Faculty Mentor:');
    // A mentor does not read the steps above them, as on a PhD form.
    expect(screen.queryByText('Recommendation of ADORDC:')).toBeNull();
  });

  it('shows the office every step, since it holds none of them', async () => {
    await renderPage(formAt('adordc', 'admin'));

    await screen.findByText('Recommendation of Faculty Mentor:');
    expect(screen.getByText('Recommendation of ADORDC:')).toBeTruthy();
    expect(screen.getByText('Recommendation of DORDC:')).toBeTruthy();
  });
});
