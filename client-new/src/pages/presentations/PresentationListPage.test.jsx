// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

// The page's own decisions are which tabs to show and what the table is handed.
const tableCalls = [];
vi.mock('../../components/dashboard/layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('./SemsterStatsCard', () => ({ default: () => null }));
vi.mock('../../components/pagenationTable/PagenationTable', () => ({
  default: (props) => {
    tableCalls.push(props);
    return null;
  },
}));

const PresentationListPage = (await import('./PresentationListPage')).default;

afterEach(() => {
  cleanup();
  tableCalls.length = 0;
  localStorage.clear();
});

const renderAs = (role) => {
  localStorage.setItem('userRole', role);
  render(
    <MemoryRouter initialEntries={['/presentation/semester/2627ODD']}>
      <Routes>
        <Route path="/presentation/semester/:semester_id" element={<PresentationListPage />} />
      </Routes>
    </MemoryRouter>
  );
  return tableCalls[tableCalls.length - 1];
};

const filterKeys = (props) => (props.filters?.mandatory_filter ?? []).map((filter) => filter.key);

describe('PresentationListPage', () => {
  it('opens admin on every evaluation, with no Action required tab and no bulk approve', () => {
    const table = renderAs('admin');
    expect(screen.queryByText('Action required')).toBeNull();
    expect(screen.getByText('All progress monitoring')).toBeTruthy();
    expect(filterKeys(table)).not.toContain('action');
    expect(table.enableApproval).toBe(false);
  });

  it('shows Not scheduled only to roles the server answers, and never the empty Semester off tab', () => {
    for (const role of ['hod', 'phd_coordinator', 'faculty', 'dordc', 'admin']) {
      renderAs(role);
      expect(screen.getByText('Not scheduled')).toBeTruthy();
      expect(screen.queryByText('Semester off')).toBeNull();
      cleanup();
    }
    for (const role of ['adordc', 'dra', 'director']) {
      renderAs(role);
      expect(screen.queryByText('Not scheduled')).toBeNull();
      cleanup();
    }
  });

  // Who may use it is the list's answer (can_bulk_approve), which the table
  // reads; the page only says where it belongs.
  it('asks for bulk approve on Action required, whatever the role', () => {
    for (const role of ['hod', 'dordc', 'faculty', 'phd_coordinator']) {
      const table = renderAs(role);
      expect(screen.getByText('Action required')).toBeTruthy();
      expect(filterKeys(table)).toContain('action');
      expect(table.enableApproval).toBe(true);
      cleanup();
    }
  });
});
