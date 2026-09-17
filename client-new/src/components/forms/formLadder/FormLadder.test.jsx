// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

// Recommendation pulls in routing, the loading context and the form API. The
// ladder's job is only to decide which panels render and with what props, so
// stand in for it and record what it was handed.
const recommendationCalls = [];
vi.mock('../layouts/Recommendation', () => ({
  default: (props) => {
    recommendationCalls.push(props);
    return <div data-testid={`rec-${props.role}`}>{props.role}</div>;
  },
}));

const FormLadder = (await import('./FormLadder')).default;

afterEach(() => {
  cleanup();
  recommendationCalls.length = 0;
});

const Bespoke = (name) => ({ refetchData }) => (
  <div data-testid={`panel-${name}`}>{name}{refetchData ? ':refetch' : ''}</div>
);
const Student = Bespoke('student');
const Supervisor = Bespoke('supervisor');

// Synopsis Submission's real chain.
const SYNOPSIS = ['student', 'faculty', 'phd_coordinator', 'hod', 'dra', 'adordc', 'dordc', 'director', 'complete'];

const renderSynopsis = (role) => render(
  <FormLadder
    formData={{ role, steps: SYNOPSIS }}
    panels={{ student: Student, faculty: Supervisor }}
  />
);

describe('FormLadder', () => {
  it('renders every step up to and including the reader', () => {
    renderSynopsis('hod');
    expect(screen.getByTestId('panel-student')).toBeTruthy();
    expect(screen.getByTestId('panel-supervisor')).toBeTruthy();
    expect(screen.getByTestId('rec-phd_coordinator')).toBeTruthy();
    expect(screen.getByTestId('rec-hod')).toBeTruthy();
  });

  it('stops at the reader', () => {
    renderSynopsis('faculty');
    expect(screen.getByTestId('panel-student')).toBeTruthy();
    expect(screen.getByTestId('panel-supervisor')).toBeTruthy();
    expect(screen.queryByTestId('rec-phd_coordinator')).toBeNull();
    expect(screen.queryByTestId('rec-hod')).toBeNull();
  });

  // The step is named "faculty"; approvals, comments and locks key that person
  // as "supervisor", and Recommendation looks them up by role.
  it('asks Recommendation for the supervisor role on the faculty step', () => {
    render(
      <FormLadder formData={{ role: 'dra', steps: ['student', 'faculty', 'dra'] }} panels={{}} />
    );
    expect(recommendationCalls.map((c) => c.role)).toEqual(['student', 'supervisor', 'dra']);
  });

  // 'complete' terminates the chain. It is not a role and has no panel, so it
  // must never reach Recommendation, which would title one after it.
  it('never renders a panel for the complete step', () => {
    render(<FormLadder formData={{ role: 'admin', steps: ['student', 'hod', 'complete'] }} panels={{}} />);
    expect(recommendationCalls.map((c) => c.role)).toEqual(['student', 'hod']);
  });

  it('gives admin every step', () => {
    renderSynopsis('admin');
    expect(screen.getByTestId('rec-director')).toBeTruthy();
    expect(screen.getByTestId('panel-student')).toBeTruthy();
  });

  it('renders nothing for a role the chain does not contain', () => {
    const { container } = renderSynopsis('clerk');
    expect(container.textContent).toBe('');
  });

  // Supervisor Change raised before the student's IRB submission is complete
  // drops DORDC and DRA (SupervisorChangeFormController::createForm). The stored
  // chain is the only thing that knows, so the panels have to follow it.
  it('follows a shortened chain stored on the form', () => {
    const short = ['student', 'phd_coordinator', 'hod', 'complete'];
    render(<FormLadder formData={{ role: 'hod', steps: short }} panels={{}} />);
    expect(recommendationCalls.map((c) => c.role)).toEqual(['student', 'phd_coordinator', 'hod']);
    expect(screen.queryByTestId('rec-dordc')).toBeNull();
    expect(screen.queryByTestId('rec-dra')).toBeNull();
  });

  it('defaults allowRejection to false and lets a step override it', () => {
    render(
      <FormLadder
        formData={{ role: 'director', steps: ['faculty', 'dordc', 'director', 'complete'] }}
        panels={{}}
        stepProps={{ director: { allowRejection: true } }}
      />
    );
    const byRole = Object.fromEntries(recommendationCalls.map((c) => [c.role, c.allowRejection]));
    expect(byRole.supervisor).toBe(false);
    expect(byRole.dordc).toBe(false);
    expect(byRole.director).toBe(true);
  });

  it('passes per-step extras to a bespoke panel', () => {
    render(
      <FormLadder
        formData={{ role: 'student', steps: ['student', 'faculty'] }}
        panels={{ student: Student }}
        stepProps={{ student: { refetchData: () => {} } }}
      />
    );
    expect(screen.getByTestId('panel-student').textContent).toBe('student:refetch');
  });

  it('hands every panel the form data', () => {
    const formData = { role: 'hod', steps: ['student', 'hod'] };
    render(<FormLadder formData={formData} panels={{}} />);
    expect(recommendationCalls.every((c) => c.formData === formData)).toBe(true);
  });
});
