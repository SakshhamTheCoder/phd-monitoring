import { describe, it, expect } from 'vitest';
import { countAbsent, applyMarkAll, buildSaveMessage } from './attendanceMark';

const students = [
  { roll_no: '1', on_leave: false },
  { roll_no: '2', on_leave: false },
  { roll_no: '3', on_leave: true },
];

describe('countAbsent', () => {
  it('counts absent scholars who are not on leave', () => {
    const statuses = { 1: 'absent', 2: 'present', 3: 'absent' };
    expect(countAbsent(students, statuses)).toBe(1);
  });

  it('ignores a stale absent value for a scholar on leave', () => {
    const statuses = { 3: 'absent' };
    expect(countAbsent(students, statuses)).toBe(0);
  });

  it('is zero when nobody is marked absent', () => {
    expect(countAbsent(students, {})).toBe(0);
  });
});

describe('applyMarkAll', () => {
  it('sets the status for every scholar not on leave', () => {
    const next = applyMarkAll(students, {}, 'present');
    expect(next['1']).toBe('present');
    expect(next['2']).toBe('present');
  });

  it('leaves a scholar on leave untouched rather than forcing a status', () => {
    const prev = { 3: 'present' };
    const next = applyMarkAll(students, prev, 'absent');
    expect(next['3']).toBe('present');
  });

  it('does not invent an entry for a scholar on leave who had none', () => {
    const next = applyMarkAll(students, {}, 'absent');
    expect(next['3']).toBeUndefined();
  });
});

describe('buildSaveMessage', () => {
  it('passes the backend message through unchanged when nothing was skipped', () => {
    expect(buildSaveMessage('Attendance saved for 5 student(s).', 0)).toBe('Attendance saved for 5 student(s).');
  });

  it('falls back to a generic message when the backend sent none', () => {
    expect(buildSaveMessage(undefined, 0)).toBe('Attendance saved');
  });

  it('appends a skip note when scholars on approved leave were skipped', () => {
    expect(buildSaveMessage('Attendance saved for 5 student(s).', 2)).toBe(
      'Attendance saved for 5 student(s). 2 scholar(s) on approved leave were skipped.'
    );
  });

  it('treats a missing/null skip count as zero', () => {
    expect(buildSaveMessage('Attendance saved for 5 student(s).', null)).toBe('Attendance saved for 5 student(s).');
    expect(buildSaveMessage('Attendance saved for 5 student(s).', undefined)).toBe('Attendance saved for 5 student(s).');
  });

  it('does not special-case a single skip — wording stays count-agnostic', () => {
    expect(buildSaveMessage('Attendance saved for 5 student(s).', 1)).toBe(
      'Attendance saved for 5 student(s). 1 scholar(s) on approved leave were skipped.'
    );
  });

  // POST /clerks/attendance/csv (Task 7) reports its skip count nested under
  // `data.skipped_on_leave` rather than top-level like the save endpoint, and
  // its own message already names a count in passing ("N on leave") — the
  // shape still fits this helper since it only ever takes the two already-
  // extracted values, regardless of where the caller found them.
  it('fits the CSV import response shape too, appended after its own message', () => {
    expect(buildSaveMessage('Import done: 5 created, 2 updated, 1 skipped, 3 on leave, 0 errors', 3)).toBe(
      'Import done: 5 created, 2 updated, 1 skipped, 3 on leave, 0 errors 3 scholar(s) on approved leave were skipped.'
    );
  });
});
