import { describe, it, expect } from 'vitest';
import { formatDate, EMPTY_VALUE } from './timeParse';

describe('formatDate', () => {
  it('formats a real date', () => {
    expect(formatDate('2026-03-14')).toBe('14 Mar 2026');
  });

  it('formats a full ISO timestamp', () => {
    expect(formatDate('2026-03-14T09:30:00.000Z')).toBe('14 Mar 2026');
  });

  it('returns EMPTY_VALUE for null and undefined', () => {
    expect(formatDate(null)).toBe(EMPTY_VALUE);
    expect(formatDate(undefined)).toBe(EMPTY_VALUE);
  });

  it('returns EMPTY_VALUE for an empty or blank string', () => {
    expect(formatDate('')).toBe(EMPTY_VALUE);
    expect(formatDate('   ')).toBe(EMPTY_VALUE);
  });

  it('returns EMPTY_VALUE for an unparseable value', () => {
    expect(formatDate('not a date')).toBe(EMPTY_VALUE);
  });

  it('never renders the epoch as a real date', () => {
    expect(formatDate(0)).toBe(EMPTY_VALUE);
    expect(formatDate('1970-01-01')).toBe(EMPTY_VALUE);
    expect(formatDate('1970-01-01T00:00:00.000Z')).toBe(EMPTY_VALUE);
    expect(formatDate('0000-00-00')).toBe(EMPTY_VALUE);
  });

  it('accepts a caller-supplied fallback', () => {
    expect(formatDate(null, 'Not set')).toBe('Not set');
  });
});
