// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach } from 'vitest';
import UrfRecord from './UrfRecord';

const project = {
  id: 4,
  session: 2026,
  status: 'selected',
  stage: 'complete',
  project_title: 'Low power sensing',
  created_at: '2026-01-05',
  student1_name: 'Ug One',
  student1_roll_no: '102203001',
  student1_year: 3,
  // What used to be spelled out on this page, for anyone who could open it.
  fellows: [{ id: 7, full_name: 'Ug One', pan: 'ABCDE1234F', aadhaar: '123456789012', account_no: '987654321098' }],
  reports: [{ id: 9, type: 'half_yearly', created_at: '2026-06-01', conference_presentation: 'Patiala' }],
};

const show = (overrides = {}) => render(
  <MemoryRouter initialEntries={['/urf/4']}>
    <UrfRecord record={{ ...project, ...overrides }} />
  </MemoryRouter>,
);

afterEach(cleanup);

describe('the URF project page', () => {
  it('names the project and its team', () => {
    show();

    expect(screen.getByText('Low power sensing')).toBeDefined();
    expect(screen.getByText('102203001')).toBeDefined();
  });

  it('keeps the stipend details off the page', () => {
    const { container } = show();

    // These are read on the Additional Information form, which masks them for
    // an approver and shows them whole only to the office and the student.
    for (const value of ['ABCDE1234F', '123456789012', '987654321098']) {
      expect(container.textContent).not.toContain(value);
    }
  });

  it('offers each form as a card rather than spelling its contents out', () => {
    show();

    expect(screen.getByText('URF Application Form')).toBeDefined();
    expect(screen.getByText('Additional Information Form')).toBeDefined();
    expect(screen.getByText('Half-yearly Progress Report')).toBeDefined();
    // The reports table that used to carry this column is gone with it.
    expect(screen.queryByText('Conference Presentation')).toBeNull();
  });
});
