// @vitest-environment jsdom
import React from 'react';
import { render, cleanup, fireEvent, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, afterEach, vi } from 'vitest';

// What the page hands the table, recorded on every render.
const tableCalls = [];
let currentView = null;

vi.mock('../pagenationTable/PagenationTable', () => ({
  default: (props) => {
    tableCalls.push(props);
    return null;
  },
}));
vi.mock('../filterBar/FilterBar', () => ({ default: () => null }));
vi.mock('../../api/views', async (actual) => ({
  ...(await actual()),
  useView: () => ({ view: currentView, failed: false, retry: () => {}, reload: () => {} }),
}));
vi.mock('../../hooks/useScholarInPath', () => ({ default: () => null }));
vi.mock('../../context/LoadingContext', () => ({ useLoading: () => ({ setLoading: () => {} }) }));

const ServerListPage = (await import('./ServerListPage')).default;

afterEach(() => {
  cleanup();
  tableCalls.length = 0;
});

const page = (parts) => ({ version: 1, title: 'A list', actions: [], dialogs: {}, imports: {}, ...parts });
const last = () => tableCalls[tableCalls.length - 1];
const at = (path, route = '*') => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path={route} element={<ServerListPage page="a-page" />} /></Routes>
  </MemoryRouter>,
);

describe('ServerListPage', () => {
  it('scopes every request to the session picked, from the first one', () => {
    currentView = page({
      scope: { key: 'session', value: '2026', options: [{ value: '2026', title: 'URF 2026' }, { value: '2025', title: 'URF 2025' }] },
      table: { endpoint: '/urf/urf-final-report', filters: { conditions: [] }, actions: [] },
    });
    at('/urf/urf-final-report');

    // One carrying no session is a request for every year, and it can answer
    // after the right one.
    expect(tableCalls.map((props) => props.filters.mandatory_filter)).toEqual(
      tableCalls.map(() => [{ key: 'session', op: '=', value: '2026' }]),
    );
    expect(last().endpoint).toBe('/urf/urf-final-report');
  });

  it('reads its list from the path it is on, with the route filled in', () => {
    currentView = page({ table: { endpoint: '{path}/not-scheduled', actions: [] } });
    at('/presentation/semester/2627ODD', '/presentation/semester/:semester_id');

    expect(last().endpoint).toBe('/presentation/semester/2627ODD/not-scheduled');
  });

  it('asks for the tab on screen, with its own filters and approval', () => {
    currentView = page({
      tab: 1,
      tabs: [
        { value: 0, label: 'Action required', actions: [], table: { endpoint: '/x', filters: { mandatory_filter: [{ key: 'action', value: 1 }] }, approval: true, actions: [] } },
        { value: 1, label: 'Completed', actions: [], table: { endpoint: '/x', filters: { mandatory_filter: [{ key: 'missed', op: '=', value: 0 }] }, actions: [] } },
      ],
    });
    at('/x');

    expect(last().filters.mandatory_filter[0].key).toBe('missed');
    expect(last().enableApproval).toBe(false);

    fireEvent.click(screen.getByRole('tab', { name: 'Action required' }));
    expect(last().filters.mandatory_filter[0].key).toBe('action');
    expect(last().enableApproval).toBe(true);
  });

  it('offers the row actions the view gives, and opens nothing it does not', () => {
    currentView = page({ table: { endpoint: '/x', actions: [{ label: 'Edit', icon: 'fa fa-pencil', opens: 'edit' }] } });
    at('/x');

    expect(last().actions.map((action) => action.tooltip)).toEqual(['Edit']);
    expect(last().rowClickable).toBe(false);
  });
});
