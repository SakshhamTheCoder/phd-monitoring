import { describe, it, expect } from 'vitest';
import { formatDate } from './timeParse';

describe('formatDate', () => {
  it('formats a real date', () => {
    expect(formatDate('2026-03-14')).toBe('14 Mar 2026');
  });

  it('formats a full ISO timestamp', () => {
    expect(formatDate('2026-03-14T09:30:00.000Z')).toBe('14 Mar 2026');
  });

  it('returns an em dash for null and undefined', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
  });

  it('returns an em dash for an empty or blank string', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate('   ')).toBe('—');
  });

  it('returns an em dash for an unparseable value', () => {
    expect(formatDate('not a date')).toBe('—');
  });

  it('never renders the epoch as a real date', () => {
    expect(formatDate(0)).toBe('—');
    expect(formatDate('1970-01-01')).toBe('—');
    expect(formatDate('1970-01-01T00:00:00.000Z')).toBe('—');
    expect(formatDate('0000-00-00')).toBe('—');
  });

  it('accepts a caller-supplied fallback', () => {
    expect(formatDate(null, 'Not set')).toBe('Not set');
  });
});
