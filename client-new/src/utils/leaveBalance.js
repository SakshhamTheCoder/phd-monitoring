// Pure helpers for the leave UI. Kept out of the components so they can be
// tested: vitest runs with environment 'node', so nothing here may touch the DOM.

/**
 * A notification links to /attendance?tab=leaves&leave=42. Read that back so the
 * page can open the right tab with the right application in view.
 */
export const parseAttendanceQuery = (search) => {
  const params = new URLSearchParams(search || '');
  const rawLeave = params.get('leave');
  const leave = Number.parseInt(rawLeave, 10);

  return {
    tab: params.get('tab'),
    leave: Number.isFinite(leave) ? leave : null,
  };
};

/** Days past the quota, or 0 while within it. Never negative. */
export const overageOf = (balance) => {
  if (!balance) return 0;
  const over = (Number(balance.used) || 0) - (Number(balance.quota) || 0);
  return over > 0 ? over : 0;
};

/** Leave is counted in halves, so print 2 rather than 2.0 and keep 0.5. */
export const formatDays = (n) => {
  const value = Number(n) || 0;
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const pad2 = (n) => String(n).padStart(2, '0');

/**
 * Laravel casts `Attendance.date` / `StudentLeaveForm.from_date`/`to_date` as
 * `date`, and `server/.env` sets APP_TIMEZONE=Asia/Kolkata. Carbon therefore
 * serializes a record stored as "2024-05-01" as
 * "2024-04-30T18:30:00.000000Z" — midnight IST expressed in UTC. Slicing
 * that raw string files it under the wrong day/month. Parsing with `new
 * Date(value)` and reading back the *local* getters undoes exactly that
 * shift (the same round trip client-new/src/utils/timeParse.js already uses
 * for display strings), so this is the only correct way to read the date a
 * record actually falls on in the browser's own timezone.
 *
 * A null/undefined/empty value returns '' rather than a formatted "Invalid
 * Date"; a non-empty value `new Date` can't parse is returned unchanged
 * rather than emitting NaN.
 */
export const localDateString = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Same local-time round trip as localDateString, truncated to the month —
 * for bucketing records by month without a UTC-midnight serialization
 * shifting a 1st-of-month record into the prior month. */
export const localMonthKey = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
};
