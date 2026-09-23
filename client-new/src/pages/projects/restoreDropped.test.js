import { describe, expect, it } from 'vitest';
import { KEY_OTHER, dropOtherRow, setOtherAmount } from '../../data/projectsData';
import { restoreDropped } from './ProjectBudgetStep';

describe('restoreDropped', () => {
  it('puts a dropped row and its sub-rows back in place and keeps later edits', () => {
    const budget = {
      [KEY_OTHER]: {
        year1: [
          { id: 'print', label: 'Printing', parent: '', amount: 100 },
          { id: 'ink', label: 'Ink', parent: 'print', amount: 40 },
          { id: 'travel', label: 'Travel', parent: '', amount: 300 },
        ],
      },
    };

    const after = dropOtherRow(budget, 'print');
    const edited = setOtherAmount(after, 'year1', 'travel', '', 350);
    const restored = restoreDropped(edited, budget, after);

    expect(restored[KEY_OTHER].year1.map((l) => [l.id, l.amount])).toEqual([
      ['print', 100], ['ink', 40], ['travel', 350],
    ]);
  });
});
