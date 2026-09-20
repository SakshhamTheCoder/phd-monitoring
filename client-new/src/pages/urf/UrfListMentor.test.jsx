// @vitest-environment jsdom
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

// What the page hands the form grid, recorded on every render.
const gridCalls = [];

vi.mock('../../components/dashboard/layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/filterBar/FilterBar', () => ({
  default: ({ onSearch }) => {
    React.useEffect(() => { onSearch({ combine: 'and', conditions: [] }); }, []);
    return null;
  },
}));
vi.mock('../../components/pagenationTable/PagenationTable', () => ({ default: () => null }));
vi.mock('../../components/urf/UrfReportSchedule', () => ({ default: () => null }));
vi.mock('../../components/forms/formGrid/FormGrid', () => ({
  default: (props) => {
    gridCalls.push(props);
    return null;
  },
}));
vi.mock('../../api/settings', () => ({
  apiSettings: () => Promise.resolve({ success: true, response: { applications_open: 1 } }),
  apiSaveSettings: () => Promise.resolve({ success: false }),
}));
vi.mock('../../api/urf', () => ({
  apiUrfSessions: () => Promise.resolve({ success: true, response: [2026] }),
  // One half-yearly report is waiting on this mentor.
  apiUrfQueue: () => Promise.resolve({
    success: true,
    response: { data: [{ id: 9, form: 'urf-half-yearly-report', project_title: 'Low power sensing' }] },
  }),
  apiUrfStatus: () => Promise.resolve({ success: true }),
  apiUrfImportAwarded: () => Promise.resolve({ success: true, response: {} }),
}));
// A mentor: they read what they mentor, they do not manage the fellowship.
vi.mock('../../context/CapabilitiesContext', () => {
  const can = (name) => name === 'can_read_urf_mentees';
  return { default: () => can, useCapabilities: () => can, useCapabilitiesKnown: () => true };
});

const UrfList = (await import('./UrfList')).default;

afterEach(() => {
  cleanup();
  gridCalls.length = 0;
});

describe('URF for a mentor', () => {
  it('offers the form cards, and lights the one waiting on them', async () => {
    render(<MemoryRouter initialEntries={['/urf']}><UrfList /></MemoryRouter>);

    // The cards used to be behind can_manage_urf, so a mentor saw none.
    await waitFor(() => expect(gridCalls.length).toBeGreaterThan(0));
    await waitFor(() => {
      const forms = gridCalls[gridCalls.length - 1].forms;
      const lit = forms.filter((form) => form.action_required).map((form) => form.form_type);
      expect(lit).toEqual(['urf-half-yearly-report']);
    });

    // All four are offered, not only the one with something waiting.
    expect(gridCalls[gridCalls.length - 1].forms).toHaveLength(4);
  });
});
