// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

// is_open is the server's answer, so the fixtures carry it as the server would.
const WINDOWS = [
  { id: 1, session: 2026, type: 'half_yearly', opens_on: day(-10), closes_on: day(10), is_open: true, notes: '' },
  { id: 2, session: 2026, type: 'final', opens_on: day(20), closes_on: day(40), is_open: false, notes: '' },
  { id: 3, session: 2025, type: 'final', opens_on: day(-60), closes_on: day(-30), is_open: false, notes: '' },
];

vi.mock('../../api/urf', () => ({
  apiUrfReportWindows: () => Promise.resolve({ success: true, response: WINDOWS }),
  apiUrfSaveReportWindow: () => Promise.resolve({ success: true }),
  apiUrfDeleteReportWindow: () => Promise.resolve({ success: true }),
}));

const UrfReportSchedule = (await import('./UrfReportSchedule')).default;

afterEach(cleanup);

const show = async () => {
  const view = render(<UrfReportSchedule session={2026} sessions={[2026, 2025]} />);
  await waitFor(() => expect(screen.getByText('Open')).toBeDefined());

  return view;
};

const roundRows = (container) => [...container.querySelectorAll('.custom-table tbody tr')];

describe('the report round schedule', () => {
  it('says a round that has not started yet is upcoming, not closed', async () => {
    await show();

    // is_open is false for both, and calling the later one Closed said a round
    // was over before it began.
    expect(screen.getByText('Upcoming')).toBeDefined();
    expect(screen.queryByText('Closed')).toBeNull();
  });

  it('shows the rounds of the session on screen and not the others', async () => {
    const { container } = await show();

    // Two rounds for 2026; the 2025 one is the picker's to bring back, not the
    // table's to mix in. The year is read from the rows rather than the whole
    // panel, which names every session in the dropdown.
    const rows = roundRows(container);
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.textContent.includes('2025'))).toBe(false);
  });

  it('offers to move a round already scheduled rather than add a second', async () => {
    await show();

    // The form opens on half-yearly, which 2026 already has.
    expect(screen.getByText('Update round')).toBeDefined();
    expect(screen.queryByText('Schedule round')).toBeNull();
  });
});
