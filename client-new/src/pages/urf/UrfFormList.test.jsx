// @vitest-environment jsdom
import React from 'react';
import { render, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

// What the page hands the table, recorded on every render. The session is the
// page's own scope, so the table must never be asked for a year other than the
// one on screen.
const tableCalls = [];

vi.mock('../../components/dashboard/layout', () => ({ default: ({ children }) => <div>{children}</div> }));
vi.mock('../../components/filterBar/FilterBar', () => ({
  default: ({ onSearch }) => {
    React.useEffect(() => { onSearch({ combine: 'and', conditions: [], mandatory_filter: [] }); }, []);
    return null;
  },
}));
vi.mock('../../components/pagenationTable/PagenationTable', () => ({
  default: (props) => {
    tableCalls.push(props);
    return null;
  },
}));
vi.mock('../../api/urf', () => ({
  apiUrfSessions: () => Promise.resolve({ success: true, response: [2026, 2025] }),
}));
vi.mock('../../context/CapabilitiesContext', () => ({
  default: () => () => true,
  useCapabilities: () => () => true,
  useCapabilitiesKnown: () => true,
}));

const UrfFormList = (await import('./UrfFormList')).default;

afterEach(() => {
  cleanup();
  tableCalls.length = 0;
});

const sessionOf = (props) => (props.filters?.mandatory_filter ?? [])
  .find((condition) => condition.key === 'session')?.value;

describe('UrfFormList', () => {
  it('opens on the newest session and scopes the table to it', async () => {
    render(
      <MemoryRouter initialEntries={['/urf/urf-additional-info']}>
        <UrfFormList />
      </MemoryRouter>,
    );

    // The table waits for the session list, so nothing is asked for before it.
    await waitFor(() => expect(tableCalls.length).toBeGreaterThan(0));
    // Every render, not only the last: one carrying no session is a request in
    // flight for every year, and it can answer after the right one.
    expect(tableCalls.map(sessionOf)).toEqual(tableCalls.map(() => '2026'));
  });

  it('reads the form list from the page it is on', async () => {
    render(
      <MemoryRouter initialEntries={['/urf/urf-final-report']}>
        <UrfFormList />
      </MemoryRouter>,
    );

    await waitFor(() => expect(tableCalls.length).toBeGreaterThan(0));
    expect(tableCalls[tableCalls.length - 1].endpoint).toBe('/urf/urf-final-report');
  });
});
