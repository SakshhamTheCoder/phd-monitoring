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
