// Shared constants and helpers for the Projects module.

export const categoryOptions = [
  'In-house', 'Research', 'Consultancy', 'Industry', 'International', 'Other'
];

export const roleOptions = ['PI', 'Co-PI'];

export const milestoneStatusOptions = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

export const positionTypes = [
  'JRF', 'SRF', 'Research Associate', 'Research Intern', 'UG Intern', 'PG Intern'
];

export const formatCurrency = (amount) => {
  const value = Number(amount) || 0;
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
};

// Format an ISO / YYYY-MM-DD date string as DD-MM-YYYY for display.
export const formatDate = (d) => {
  if (!d) return '';
  const parts = String(d).split('T')[0].split('-');
  if (parts.length !== 3) return d;
  const [y, m, day] = parts;
  return `${day}-${m}-${y}`;
};

export const getMilestoneProgress = (milestones) => {
  if (!milestones || milestones.length === 0) return 0;
  const completed = milestones.filter(m => m.status === 'Completed').length;
  return Math.round((completed / milestones.length) * 100);
};

// Budget sub-items live under a reserved key: budget.__subitems[year][head][sub].
// Travel still uses the sub-item mechanism (Domestic / International).
export const subVal = (b, year, head, sub) =>
  Number(b && b.__subitems && b.__subitems[year] && b.__subitems[year][head] ? (b.__subitems[year][head][sub] || 0) : 0);

export const setSubCell = (budget, year, head, sub, value) => {
  const subs = { ...(budget.__subitems || {}) };
  const ys = { ...(subs[year] || {}) };
  const hs = { ...(ys[head] || {}) };
  hs[sub] = value === '' ? 0 : Number(value);
  ys[head] = hs;
  subs[year] = ys;
  return { ...budget, __subitems: subs };
};

// Reserved keys inside projects.budget. Everything else at the top level is a
// year. Mirrors App\Support\ProjectBudget on the backend — if you change the
// arithmetic here, change it there, and vice versa.
export const KEY_SUBITEMS = '__subitems';
export const KEY_MANPOWER = '__manpower';
export const KEY_EQUIPMENT = '__equipment';
export const KEY_OTHER = '__other';
const RESERVED = [KEY_SUBITEMS, KEY_MANPOWER, KEY_EQUIPMENT, KEY_OTHER];

export const HEAD_MANPOWER = 'Manpower';
export const HEAD_EQUIPMENT = 'Equipment';
export const HEAD_OTHER = 'Any Other Expenses';

// Spoken form of a duration. Never prints a zero component, so a three-year
// project reads "3 Years" and not "3 Years 0 Months".
export const formatDuration = (years, months) => {
  const y = Math.max(0, parseInt(years, 10) || 0);
  const m = Math.max(0, parseInt(months, 10) || 0);
  const parts = [];
  if (y > 0) parts.push(`${y} ${y === 1 ? 'Year' : 'Years'}`);
  if (m > 0) parts.push(`${m} ${m === 1 ? 'Month' : 'Months'}`);
  return parts.length ? parts.join(' ') : '—';
};

export const budgetYears = (b) => Object.keys(b || {}).filter((k) => !RESERVED.includes(k));

const lines = (b, key, year) => (b && b[key] && Array.isArray(b[key][year]) ? b[key][year] : []);

export const manpowerLines = (b, year) => lines(b, KEY_MANPOWER, year);
export const equipmentLines = (b, year) => lines(b, KEY_EQUIPMENT, year);
export const otherLines = (b, year) => lines(b, KEY_OTHER, year);

// The count is the whole point: a manpower line costs count x amount.
export const manpowerTotal = (b, year) =>
  manpowerLines(b, year).reduce((s, l) => s + (Number(l.count) || 0) * (Number(l.amount) || 0), 0);
export const equipmentTotal = (b, year) =>
  equipmentLines(b, year).reduce((s, l) => s + (Number(l.amount) || 0), 0);
export const otherTotal = (b, year) =>
  otherLines(b, year).reduce((s, l) => s + (Number(l.amount) || 0), 0);

// Total of a sub-item head's own sub-items for one year (Travel is the only
// head with sub-items; Manpower/Equipment/Any Other Expenses are derived
// totals and have no sub-items of their own).
export const subItemsTotal = (b, year, head, subItems) =>
  (subItems || []).reduce((s, sub) => s + subVal(b, year, head, sub), 0);

// A sub-item head "mismatches" when its sub-items are entered but they don't
// sum to the amount typed directly against the head for that year.
export const headSubMismatch = (b, year, head, subItems) => {
  if (!subItems || !subItems.length) return false;
  const total = subItemsTotal(b, year, head, subItems);
  return total > 0 && total !== Number((b && b[year] && b[year][head]) || 0);
};

export const headTotal = (b, year, head) => {
  if (head === HEAD_MANPOWER) return manpowerTotal(b, year);
  if (head === HEAD_EQUIPMENT) return equipmentTotal(b, year);
  if (head === HEAD_OTHER) return otherTotal(b, year);
  return Number((b && b[year] && b[year][head]) || 0);
};

export const yearTotal = (b, year, heads) =>
  (heads || []).reduce((s, h) => s + headTotal(b, year, h.head), 0);

export const grandTotal = (b, heads) =>
  budgetYears(b).reduce((s, y) => s + yearTotal(b, y, heads), 0);

export const emptyBudget = (years = ['year1', 'year2', 'year3']) => {
  const b = { [KEY_SUBITEMS]: {}, [KEY_MANPOWER]: {}, [KEY_EQUIPMENT]: {}, [KEY_OTHER]: {} };
  years.forEach((y) => {
    b[y] = {};
    b[KEY_MANPOWER][y] = [];
    b[KEY_EQUIPMENT][y] = [];
    b[KEY_OTHER][y] = [];
  });
  return b;
};

// Immutable line editing, shared by the wizard and the details page so both
// mutate the budget the same way.
const withLines = (b, key, year, next) => ({ ...b, [key]: { ...(b[key] || {}), [year]: next } });

export const addLine = (b, key, year, blank) =>
  withLines(b, key, year, [...lines(b, key, year), blank]);

export const removeLine = (b, key, year, index) =>
  withLines(b, key, year, lines(b, key, year).filter((_, i) => i !== index));

export const setLineField = (b, key, year, index, field, value) =>
  withLines(
    b,
    key,
    year,
    lines(b, key, year).map((l, i) => (i === index ? { ...l, [field]: value } : l))
  );

// Aliases retained for callers that add/remove/set lines by role rather than
// by reserved key directly.
export const addManpowerLine = (b, year) => addLine(b, KEY_MANPOWER, year, blankManpower());
export const removeManpowerLine = (b, year, index) => removeLine(b, KEY_MANPOWER, year, index);
export const setManpowerLine = (b, year, index, field, value) => setLineField(b, KEY_MANPOWER, year, index, field, value);

export const addEquipmentLine = (b, year) => addLine(b, KEY_EQUIPMENT, year, blankEquipment());
export const removeEquipmentLine = (b, year, index) => removeLine(b, KEY_EQUIPMENT, year, index);
export const setEquipmentLine = (b, year, index, field, value) => setLineField(b, KEY_EQUIPMENT, year, index, field, value);

export const addOtherLine = (b, year) => addLine(b, KEY_OTHER, year, blankOther());
export const removeOtherLine = (b, year, index) => removeLine(b, KEY_OTHER, year, index);
export const setOtherLine = (b, year, index, field, value) => setLineField(b, KEY_OTHER, year, index, field, value);

export const blankManpower = () => ({ category: '', count: 1, amount: 0 });
export const blankEquipment = () => ({ item: '', amount: 0 });
export const blankOther = () => ({ label: '', amount: 0 });
