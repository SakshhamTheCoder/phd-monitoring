// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

// What the page hands the table, recorded on every render. The tab is the
// page's own scope, so the table must never be asked for a stage other than
// the one on screen, not even for the render in between.
const tableCalls = [];
const filterBarCalls = [];

vi.mock('../../components/dashboard/layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/forms/formGrid/FormGrid', () => ({ default: () => null }));
vi.mock('../../components/urf/UrfReportSchedule', () => ({ default: () => null }));
vi.mock('../../components/pagenationTable/PagenationTable', () => ({
  default: (props) => {
    tableCalls.push(props);
    return null;
  },
}));
// The real bar re-emits after its own render whenever the page's mandatory
// filters change, which is the timing the page has to survive. The stand-in
// keeps that contract so the test sees the same ordering.
vi.mock('../../components/filterBar/FilterBar', () => ({
  default: ({ mandatory, onSearch }) => {
    filterBarCalls.push({ mandatory, onSearch });
    const key = JSON.stringify(mandatory ?? []);
    React.useEffect(() => {
      onSearch({ combine: 'and', conditions: [], mandatory_filter: mandatory ?? [] });
    }, [key]);
    return null;
  },
}));
vi.mock('../../api/settings', () => ({
  apiSettings: () => Promise.resolve({ success: true, response: { applications_open: 1 } }),
  apiSaveSettings: () => Promise.resolve({ success: false }),
}));
vi.mock('../../api/urf', () => ({
  apiUrfSessions: () => Promise.resolve({ success: true, response: [2026, 2025] }),
  apiUrfQueue: () => Promise.resolve({ success: true, response: { data: [] } }),
  apiUrfStatus: () => Promise.resolve({ success: true }),
}));
vi.mock('../../context/CapabilitiesContext', () => ({
  default: () => () => true,
  useCapabilities: () => () => true,
  useCapabilitiesKnown: () => true,
}));

const UrfList = (await import('./UrfList')).default;

afterEach(() => {
  cleanup();
  tableCalls.length = 0;
  filterBarCalls.length = 0;
});

const valueOf = (props, key) => (props.filters?.mandatory_filter ?? [])
  .find((condition) => condition.key === key)?.value;

const renderList = async () => {
  render(<MemoryRouter initialEntries={['/urf']}><UrfList /></MemoryRouter>);
  // The table waits for the session list, so nothing is asked for before it.
  await waitFor(() => expect(tableCalls.length).toBeGreaterThan(0));
};

describe('UrfList', () => {
  it('opens on the applied stage and the newest session', async () => {
    await renderList();
    const table = tableCalls[tableCalls.length - 1];
    expect(valueOf(table, 'status')).toBe('applied');
    expect(valueOf(table, 'session')).toBe('2026');
  });

  it('asks for the stage now on screen and never the one just left', async () => {
    await renderList();
    const before = tableCalls.length;
    screen.getByRole('tab', { name: 'Rejected' }).click();

    await waitFor(() => expect(valueOf(tableCalls[tableCalls.length - 1], 'status')).toBe('rejected'));
    // Every render since the tab was pressed, not only the last one. A render
    // carrying the stage just left is a request in flight for it, and that
    // request can answer after the right one and leave the wrong rows on screen.
    const since = tableCalls.slice(before);
    expect(since.length).toBeGreaterThan(0);
    expect(since.map((props) => valueOf(props, 'status'))).toEqual(since.map(() => 'rejected'));
  });

  it('keeps the stage and the session out of the filter bar, so they are applied once', async () => {
    await renderList();
    expect(filterBarCalls.every((props) => props.mandatory === undefined)).toBe(true);
  });
});
