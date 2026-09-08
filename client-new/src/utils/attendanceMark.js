// Pure helpers for the clerk/admin Mark tab (AttendancePage.jsx). Kept out of
// the component so they can be tested: vitest runs with environment 'node',
// so nothing here may touch the DOM.

/**
 * How many scholars are marked absent, for the filter-bar tally. A scholar on
 * approved leave never gets a radio to set — the backend refuses to write
 * their attendance row either way — so they must never inflate this count
 * even if `statuses` still carries a stale 'absent' value for them.
 */
export const countAbsent = (students, statuses) =>
  students.filter((s) => !s.on_leave && statuses[s.roll_no] === 'absent').length;

/**
 * "Mark all present/absent" only touches scholars who actually have a radio
 * to bulk-set. A scholar on leave shows a badge instead, so their entry in
 * `statuses` (whatever it is — a same-day default of 'present', or null) is
 * left untouched rather than being forced by the bulk action.
 */
export const applyMarkAll = (students, statuses, status) => {
  const next = { ...statuses };
  students.forEach((s) => {
    if (!s.on_leave) next[s.roll_no] = status;
  });
  return next;
};

/**
 * Extends the save success toast so a skip is never silent. `skippedOnLeave`
 * is `res.response.skipped_on_leave` from POST /clerks/attendance — how many
 * submitted records the backend refused to write because the scholar has an
 * approved leave covering that day.
 */
export const buildSaveMessage = (message, skippedOnLeave) => {
  const base = message || 'Attendance saved';
  const skipped = Number(skippedOnLeave) || 0;
  if (skipped <= 0) return base;
  return `${base} ${skipped} scholar(s) on approved leave were skipped.`;
};
