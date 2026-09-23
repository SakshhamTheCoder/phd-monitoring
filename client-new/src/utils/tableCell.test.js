import { describe, it, expect } from 'vitest';
import { cellClass, statusTone, isStatusKey } from './tableCell';

describe('table cells', () => {
  it('keeps short values on one line and gives prose room', () => {
    expect(cellClass('2026-09-01')).toBe('cell-nowrap');
    expect(cellClass('scholar.1@thapar.edu')).toBe('cell-nowrap');
    expect(cellClass(102203456)).toBe('cell-nowrap');
    expect(cellClass('Investigation of distributed energy storage in rural microgrids')).toBe('cell-text');
    expect(cellClass('Computer Science and Engineering')).toBe('');
    expect(cellClass(null)).toBe('');
  });

  it('reads the state in a status, negatives first', () => {
    expect(statusTone('Not Recommended')).toBe('danger');
    expect(statusTone('Rejected by HOD')).toBe('danger');
    expect(statusTone('Incomplete')).toBe('warning');
    expect(statusTone('Pending with DoRDC')).toBe('warning');
    expect(statusTone('Approved')).toBe('success');
    expect(statusTone('Complete')).toBe('success');
    expect(statusTone('Ongoing')).toBe('neutral');
  });

  it('knows a status column by its key', () => {
    expect(isStatusKey('status')).toBe(true);
    expect(isStatusKey('review_status')).toBe(true);
    expect(isStatusKey('statuses_count')).toBe(false);
  });
});
