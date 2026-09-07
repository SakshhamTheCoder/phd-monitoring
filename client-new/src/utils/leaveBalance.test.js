import { describe, it, expect } from 'vitest';
import { parseAttendanceQuery, overageOf, formatDays } from './leaveBalance';

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
