import { describe, it, expect } from 'vitest';
import { parseAttendanceQuery, overageOf, formatDays, localDateString } from './leaveBalance';

describe('parseAttendanceQuery', () => {
  it('reads the tab and leave id a notification link carries', () => {
    expect(parseAttendanceQuery('?tab=leaves&leave=42')).toEqual({ tab: 'leaves', leave: 42, roll_no: null });
  });

  it('returns nulls when the link carries nothing', () => {
    expect(parseAttendanceQuery('')).toEqual({ tab: null, leave: null, roll_no: null });
  });

  it('ignores a non-numeric leave id rather than passing NaN on', () => {
    expect(parseAttendanceQuery('?tab=leaves&leave=abc')).toEqual({ tab: 'leaves', leave: null, roll_no: null });
  });

  it('reads the roll number a scholar\u2019s profile links with', () => {
    expect(parseAttendanceQuery('?roll_no=102203001'))
      .toEqual({ tab: null, leave: null, roll_no: '102203001' });
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
// these helpers exist to undo. vite.config.mjs pins `test.env.TZ` to Asia/Kolkata (see
// commit 6166ea5), so this suite is deterministic regardless of the machine's own
// timezone; the two specific cases below rely on that pin (though the null/plain-date
// cases below are timezone-independent regardless).
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
