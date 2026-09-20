// @vitest-environment jsdom
import React from 'react';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// is_open is the server's answer, so the fixtures carry it as the server would.
const OPEN = { id: 1, session: 2026, type: 'half_yearly', opens_on: day(-10), closes_on: day(10), is_open: true, notes: '' };
const UPCOMING = { id: 2, session: 2026, type: 'final', opens_on: day(20), closes_on: day(40), is_open: false, notes: '' };
const OTHER_SESSION = { id: 3, session: 2025, type: 'final', opens_on: day(-60), closes_on: day(-30), is_open: false, notes: '' };

vi.mock('../../api/urf', () => ({
  apiUrfReportWindows: () => Promise.resolve({ success: true, response: [OPEN, UPCOMING, OTHER_SESSION] }),
  apiUrfSaveReportWindow: () => Promise.resolve({ success: true }),
  apiUrfDeleteReportWindow: () => Promise.resolve({ success: true }),
}));

const UrfReportSchedule = (await import('./UrfReportSchedule')).default;

afterEach(cleanup);

const field = (container, label) => [...container.querySelectorAll('.input-field-container')]
  .find((one) => one.textContent.startsWith(label));

const roundRows = (container) => [...container.querySelectorAll('.custom-table tbody tr')];

// The panel settles on the running round a render after the rounds arrive.
const show = async () => {
  const view = render(<UrfReportSchedule session={2026} sessions={[2026, 2025]} />);
  await waitFor(() => expect(screen.getByText(/Half-yearly Progress Report: open/)).toBeDefined());

  return view;
};

describe('the report round schedule', () => {
  it('heads the panel with the round that is running', async () => {
    const { container } = await show();

    // Its dates are in the form without anybody clicking the table, and only
    // the other round is left below. Awaited because DateField syncs its own
    // value a render after it is handed one.
    await waitFor(() => {
      expect(field(container, 'Closes On').querySelector('input').value).toBe(OPEN.closes_on);
    });
    expect(roundRows(container)).toHaveLength(1);
  });

  it('offers no way to add a second round while one is running', async () => {
    await show();

    // One round runs at a time, so there is nothing here that starts another.
    expect(screen.queryByText('New round')).toBeNull();
    expect(screen.queryByText('Schedule round')).toBeNull();
    expect(screen.getByText('Update round')).toBeDefined();
  });

  it('says a round that has not started yet is upcoming, not closed', async () => {
    await show();

    // is_open is false for it, and reading that as Closed said a round was
    // over before it began.
    expect(screen.getByText('Upcoming')).toBeDefined();
    expect(screen.queryByText('Closed')).toBeNull();
  });

  it('shows the rounds of the session on screen and not the others', async () => {
    const { container } = await show();

    // The year is read from the rows rather than the whole panel, which names
    // every session in the dropdown.
    expect(roundRows(container).some((row) => row.textContent.includes('2025'))).toBe(false);
  });

  it('settles the opening day of the round that is running', async () => {
    const { container } = await show();

    // Fellows are filing to it, so only the closing day can still move.
    expect(field(container, 'Opens On').querySelector('.field-readonly')).not.toBeNull();
    expect(field(container, 'Opens On').querySelector('input')).toBeNull();
  });
});
