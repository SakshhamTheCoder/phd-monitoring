import { describe, it, expect } from 'vitest';
import { grandTotal } from './projectsData';

// Reproduces the bug: a 3-year budget (Travel 1000/2000/3000) viewed through
// a 2-year duration window. The Grand Total must match the columns actually
// rendered, not silently include the hidden year3 data.
const heads = [{ head: 'Travel' }];
const budget = {
  year1: { Travel: 1000 },
  year2: { Travel: 2000 },
  year3: { Travel: 3000 },
};

describe('grandTotal', () => {
  it('sums over an explicit year list, ignoring years outside it', () => {
    expect(grandTotal(budget, heads, ['year1', 'year2'])).toBe(3000);
  });

  it('falls back to the data\'s own keys when no year list is given', () => {
    expect(grandTotal(budget, heads)).toBe(6000);
  });
});
