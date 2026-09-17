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
  it('opens admin on every evaluation, with no Action Required tab and no bulk approve', () => {
    const table = renderAs('admin');
    expect(screen.queryByText('Action Required')).toBeNull();
    expect(screen.getByText('All Progress Monitoring')).toBeTruthy();
    expect(filterKeys(table)).not.toContain('action');
    expect(table.enableApproval).toBe(false);
  });

  it('shows Not Scheduled only to roles the server answers, and never the empty Semester Off tab', () => {
    for (const role of ['hod', 'phd_coordinator', 'faculty', 'dordc', 'admin']) {
      renderAs(role);
      expect(screen.getByText('Not Scheduled')).toBeTruthy();
      expect(screen.queryByText('Semester Off')).toBeNull();
      cleanup();
    }
    for (const role of ['adordc', 'dra', 'director']) {
      renderAs(role);
      expect(screen.queryByText('Not Scheduled')).toBeNull();
      cleanup();
    }
  });

  it('offers bulk approve on Action Required only to roles the server accepts it from', () => {
    for (const role of ['hod', 'dordc', 'adordc']) {
      expect(renderAs(role).enableApproval).toBe(true);
      cleanup();
    }
    for (const role of ['faculty', 'phd_coordinator', 'dra', 'director']) {
      const table = renderAs(role);
      expect(screen.getByText('Action Required')).toBeTruthy();
      expect(filterKeys(table)).toContain('action');
      expect(table.enableApproval).toBe(false);
      cleanup();
    }
  });
});
