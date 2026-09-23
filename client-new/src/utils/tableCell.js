// How a plain value in a table cell is drawn, shared by PagenationTable and
// TableComponent. Pages that draw a cell themselves are not affected.

// A value with no spaces (a date, roll number, email, code) stays on one
// line: a date broke at its hyphens into "2026-09-" and "01". Long prose (a
// thesis title) gets a minimum width, so the other columns cannot squeeze it
// to a word a line. Names and short phrases wrap as they need to.
export const cellClass = (value) => {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const text = String(value);
  if (!/\s/.test(text)) return 'cell-nowrap';
  return text.length > 40 ? 'cell-text' : '';
};

// A status column reads as a badge. The word always carries the meaning; the
// tone only helps a scan down the column. Order matters: "Not recommended"
// and "Incomplete" contain the success words.
const TONES = [
  ['danger', /\b(reject|not recommend|declin|absent|cancel|withdrawn|called off)/i],
  ['warning', /\b(pending|awaiting|incomplete|draft|in progress|sent back|with )/i],
  ['success', /\b(approv|accept|complete|recommend|selected|present|active|enabled|done)/i],
];

export const statusTone = (value) => {
  const text = String(value ?? '');
  const match = TONES.find(([, pattern]) => pattern.test(text));
  return match ? match[0] : 'neutral';
};

// Column keys whose values are a state rather than data.
export const isStatusKey = (key) => /(^|_)status$/.test(key);
