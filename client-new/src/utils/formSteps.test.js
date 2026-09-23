import { describe, it, expect } from 'vitest';
import { stepReached, stepAnswered } from './formSteps';

// An IRB submission parked at the external member, read by admin: every lock
// but the current step's is set and every approval is the column default 0.
const parked = {
  steps: ['student', 'faculty', 'external', 'doctoral', 'phd_coordinator', 'hod', 'dra', 'dordc', 'complete'],
  maximum_step: 2,
  locks: { student: true, supervisor: true, external: false, doctoral: true, hod: true, dra: true, dordc: true },
  approvals: { supervisor: true, external: 0, doctoral: 0, hod: 0, dra: 0, dordc: 0 },
};

describe('form steps', () => {
  it('does not treat a step the form has not come to as answered', () => {
    expect(stepReached(parked, 'hod')).toBe(false);
    expect(stepAnswered(parked, 'hod')).toBe(false);
    expect(stepAnswered(parked, 'doctoral')).toBe(false);
  });

  it('reads the supervisor, stored as "faculty" in the chain, as answered once passed', () => {
    expect(stepAnswered(parked, 'supervisor')).toBe(true);
  });

  it('leaves the current step unanswered until it is locked', () => {
    expect(stepReached(parked, 'external')).toBe(true);
    expect(stepAnswered(parked, 'external')).toBe(false);
  });

  it('keeps the old reading when there is no chain to judge by', () => {
    expect(stepAnswered({ locks: { hod: true } }, 'hod')).toBe(true);
    expect(stepAnswered({ ...parked, maximum_step: null }, 'hod')).toBe(true);
  });
});
