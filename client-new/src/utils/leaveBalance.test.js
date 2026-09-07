import { describe, it, expect } from 'vitest';
import { parseAttendanceQuery, overageOf, formatDays, localDateString, localMonthKey, validateLeaveSettings } from './leaveBalance';

describe('parseAttendanceQuery', () => {
  it('reads the tab and leave id a notification link carries', () => {
    expect(parseAttendanceQuery('?tab=leaves&leave=42')).toEqual({ tab: 'leaves', leave: 42 });
  });

  it('returns nulls when the link carries nothing', () => {
    expect(parseAttendanceQuery('')).toEqual({ tab: null, leave: null });
  });

  it('ignores a non-numeric leave id rather than passing NaN on', () => {
    expect(parseAttendanceQuery('?tab=leaves&leave=abc')).toEqual({ tab: 'leaves', leave: null });
  });
});

describe('overageOf', () => {
  it('is zero while within quota', () => {
    expect(overageOf({ quota: 8, used: 3, remaining: 5 })).toBe(0);
  });

  it('is zero exactly at the quota', () => {
    expect(overageOf({ quota: 8, used: 8, remaining: 0 })).toBe(0);
  });

  it('reports how far past the quota the usage is', () => {
    expect(overageOf({ quota: 8, used: 10.5, remaining: -2.5 })).toBe(2.5);
  });
});

describe('formatDays', () => {
  it('drops the decimal on a whole number', () => {
    expect(formatDays(2)).toBe('2');
  });

  it('keeps a half', () => {
    expect(formatDays(0.5)).toBe('0.5');
    expect(formatDays(2.5)).toBe('2.5');
  });
});

// These assertions read the machine's local timezone (via `new Date(...).getFullYear()`
// etc, same as the runtime code under test) and are only correct when that timezone is
// Asia/Kolkata/Calcutta (UTC+5:30) — the same as server/.env's APP_TIMEZONE, which is what
// produces the "date stored as 2024-05-01 serializes as 2024-04-30T18:30:00.000000Z" shift
// these helpers exist to undo. vitest is not configured with a fixed TZ, so this suite
// inherits whatever timezone the machine running it is set to; on a machine in a different
// timezone these two specific cases would need different expected values (though the
// null/plain-date cases below are timezone-independent).
describe('localDateString', () => {
  it('undoes the UTC-midnight shift for a date-cast column serialized under Asia/Kolkata', () => {
    expect(localDateString('2024-04-30T18:30:00.000000Z')).toBe('2024-05-01');
  });

  it('passes through a plain YYYY-MM-DD unchanged', () => {
    expect(localDateString('2024-05-01')).toBe('2024-05-01');
  });

  it('returns empty string for null/undefined/empty rather than a formatted Invalid Date', () => {
    expect(localDateString(null)).toBe('');
    expect(localDateString(undefined)).toBe('');
    expect(localDateString('')).toBe('');
  });

  it('returns an unparseable value unchanged rather than NaN', () => {
    expect(localDateString('not-a-date')).toBe('not-a-date');
  });
});

describe('localMonthKey', () => {
  it('undoes the UTC-midnight shift so a 1st-of-month record files under the right month', () => {
    expect(localMonthKey('2024-04-30T18:30:00.000000Z')).toBe('2024-05');
  });

  it('passes through a plain YYYY-MM-DD truncated to the month', () => {
    expect(localMonthKey('2024-05-01')).toBe('2024-05');
  });

  it('returns empty string for null/undefined/empty rather than a formatted Invalid Date', () => {
    expect(localMonthKey(null)).toBe('');
    expect(localMonthKey(undefined)).toBe('');
    expect(localMonthKey('')).toBe('');
  });

  it('returns an unparseable value unchanged rather than NaN', () => {
    expect(localMonthKey('not-a-date')).toBe('not-a-date');
  });
});

describe('validateLeaveSettings', () => {
  const valid = { academic_quota: 10, casual_quota: 8, year_start_month: 7 };

  it('accepts values within the backend bounds', () => {
    expect(validateLeaveSettings(valid)).toBeNull();
  });

  it('accepts the boundary values (0, 365, 1, 12)', () => {
    expect(validateLeaveSettings({ academic_quota: 0, casual_quota: 365, year_start_month: 1 })).toBeNull();
    expect(validateLeaveSettings({ academic_quota: 365, casual_quota: 0, year_start_month: 12 })).toBeNull();
  });

  it('rejects an academic quota outside 0-365', () => {
    expect(validateLeaveSettings({ ...valid, academic_quota: -1 })).toMatch(/Academic quota/);
    expect(validateLeaveSettings({ ...valid, academic_quota: 366 })).toMatch(/Academic quota/);
  });

  it('rejects a casual quota outside 0-365', () => {
    expect(validateLeaveSettings({ ...valid, casual_quota: -1 })).toMatch(/Casual quota/);
    expect(validateLeaveSettings({ ...valid, casual_quota: 366 })).toMatch(/Casual quota/);
  });

  it('rejects a non-integer quota', () => {
    expect(validateLeaveSettings({ ...valid, academic_quota: 10.5 })).toMatch(/Academic quota/);
  });

  it('rejects a year_start_month outside 1-12', () => {
    expect(validateLeaveSettings({ ...valid, year_start_month: 0 })).toMatch(/start month/);
    expect(validateLeaveSettings({ ...valid, year_start_month: 13 })).toMatch(/start month/);
  });

  it('rejects an empty or missing value rather than coercing it to 0', () => {
    expect(validateLeaveSettings({ ...valid, academic_quota: '' })).toMatch(/Academic quota/);
    expect(validateLeaveSettings({ ...valid, casual_quota: null })).toMatch(/Casual quota/);
    expect(validateLeaveSettings({ ...valid, year_start_month: undefined })).toMatch(/start month/);
  });
});
