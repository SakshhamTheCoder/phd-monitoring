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
// A head total typed straight against Manpower/Equipment/Other Expenses.
// Kept out of budget[year][head], which means "the legacy total this breakdown
// reconciles to" on the server; see ProjectBudget::KEY_HEADAMT.
export const KEY_HEADAMT = '__headamt';
const RESERVED = [KEY_SUBITEMS, KEY_MANPOWER, KEY_EQUIPMENT, KEY_OTHER, KEY_HEADAMT];

export const HEAD_MANPOWER = 'Manpower';
export const HEAD_EQUIPMENT = 'Equipment';
export const HEAD_OTHER = 'Other Expenses';
// What this head was called before. Legacy budgets store amounts and sub-items
// under the old wording, so reads still have to recognise it.
export const HEAD_OTHER_LEGACY = 'Any Other Expenses';
export const HEAD_CONSUMABLES = 'Consumables';
// The heads whose breakdown can be overridden by a typed total.
export const DERIVED_HEADS = [HEAD_MANPOWER, HEAD_EQUIPMENT, HEAD_OTHER];

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

// A manpower line is just a category and an amount. A line written before the
// count was dropped still costs count x amount, so fold the multiplier in.
export const lineAmount = (l) => {
  const amount = Number((l && l.amount) || 0) || 0;
  return l && Object.prototype.hasOwnProperty.call(l, 'count')
    ? amount * (Number(l.count) || 0)
    : amount;
};
export const manpowerTotal = (b, year) =>
  manpowerLines(b, year).reduce((s, l) => s + lineAmount(l), 0);
export const equipmentTotal = (b, year) =>
  equipmentLines(b, year).reduce((s, l) => s + (Number(l.amount) || 0), 0);
// Sub-rows break a parent row down; counting both would bill the same money twice.
export const isTopLevel = (l) => !String((l && l.parent) || '').trim();
export const otherTotal = (b, year) =>
  otherLines(b, year).filter(isTopLevel).reduce((s, l) => s + (Number(l.amount) || 0), 0);

// A hand-typed head total, or null when the breakdown is the total.
export const typedHead = (b, year, head) => {
  const v = b && b[KEY_HEADAMT] && b[KEY_HEADAMT][year] ? b[KEY_HEADAMT][year][head] : undefined;
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const setTypedHead = (b, year, head, value) => {
  const years = { ...((b && b[KEY_HEADAMT]) || {}) };
  const row = { ...(years[year] || {}) };
  if (value === '' || value === null || value === undefined) delete row[head];
  else row[head] = Number(value) || 0;
  years[year] = row;
  return { ...b, [KEY_HEADAMT]: years };
};

// Total of a sub-item head's own sub-items for one year (Travel is the only
// head with sub-items; Manpower/Equipment/Other Expenses are derived
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
  if (DERIVED_HEADS.includes(head)) {
    const typed = typedHead(b, year, head);
    if (typed !== null) return typed;
  }
  if (head === HEAD_MANPOWER) return manpowerTotal(b, year);
  if (head === HEAD_EQUIPMENT) return equipmentTotal(b, year);
  if (head === HEAD_OTHER) return otherTotal(b, year);
  return Number((b && b[year] && b[year][head]) || 0);
};

export const yearTotal = (b, year, heads) =>
  (heads || []).reduce((s, h) => s + headTotal(b, year, h.head), 0);

// `years` lets a caller sum over the exact year list it renders (e.g. the
// wizard's duration-derived columns), so the Grand Total agrees with the
// columns actually shown. Falls back to the data's own keys — the right
// behaviour for ProjectDetails, which shows whatever the project has rather
// than a duration-derived window.
export const grandTotal = (b, heads, years) =>
  (years || budgetYears(b)).reduce((s, y) => s + yearTotal(b, y, heads), 0);

export const emptyBudget = (years = ['year1', 'year2', 'year3']) => {
  const b = { [KEY_SUBITEMS]: {}, [KEY_MANPOWER]: {}, [KEY_EQUIPMENT]: {}, [KEY_OTHER]: {}, [KEY_HEADAMT]: {} };
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

// Union of free-form line labels across all years, first-appearance order.
// Powers the single-table budget: one row per label, one amount cell per year.
// Blank labels are excluded; a fresh unsaved row is rendered separately by
// the caller (see equipRows below) so it never leaks into read mode.
export const unionLabels = (b, key, field) => {
  const out = [];
  for (const y of Object.keys((b && b[key]) || {})) {
    for (const l of (((b[key] || {})[y]) || [])) {
      const v = String((l && l[field]) || '').trim();
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
};

// Labels plus at most one blank entry for a fresh unsaved row.
// --- Row identity ------------------------------------------------------------
// Equipment and Other Expenses rows are identified by a stable id, not by their
// label. Labels can't be the identity: two rows you just added are both blank,
// so they'd collapse into one and the "Add" button would have to hide itself
// until you named the first. An id lets any number of unnamed rows coexist.
//
// Rows saved before ids existed have none, so they fall back to a key derived
// from the label — which is what grouped them across years before anyway.
let rowSeq = 0;
export const newRowId = () => `r${Date.now().toString(36)}${(rowSeq += 1).toString(36)}`;

export const rowKey = (l, labelField) =>
  (l && l.id) ? String(l.id) : `label:${String((l && l[labelField]) || '').trim()}`;

const atKey = (l, labelField, key) => rowKey(l, labelField) === key;

// Rows of a line list in first-appearance order across years, each carrying the
// key the UI edits by and the label it currently shows.
const rowsOf = (b, listKey, labelField, keep = () => true) => {
  const out = [];
  const seen = new Set();
  for (const y of Object.keys((b && b[listKey]) || {})) {
    for (const l of (((b[listKey] || {})[y]) || [])) {
      if (!keep(l)) continue;
      const key = rowKey(l, labelField);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, label: String((l && l[labelField]) || '').trim() });
    }
  }
  return out;
};

const lineAtKey = (b, listKey, labelField, year, key) =>
  lines(b, listKey, year).find((l) => atKey(l, labelField, key)) || null;

// Set one row's amount for one year, creating the line if that year lacks it.
// A created line reuses the row's id so it stays the same row across years.
const setRowAmount = (b, listKey, labelField, year, key, amount, template) => {
  const val = amount === '' ? 0 : Number(amount);
  const cur = lines(b, listKey, year);
  const i = cur.findIndex((l) => atKey(l, labelField, key));
  if (i >= 0) {
    return withLines(b, listKey, year, cur.map((l, j) => (j === i ? { ...l, amount: val } : l)));
  }
  return withLines(b, listKey, year, [...cur, { ...template, amount: val }]);
};

const renameRow = (b, listKey, labelField, key, label) => {
  let out = b;
  for (const y of Object.keys((b && b[listKey]) || {})) {
    const cur = lines(out, listKey, y);
    if (cur.some((l) => atKey(l, labelField, key))) {
      out = withLines(out, listKey, y,
        cur.map((l) => (atKey(l, labelField, key) ? { ...l, [labelField]: label } : l)));
    }
  }
  return out;
};

const dropRow = (b, listKey, labelField, key, alsoDrop = () => false) => {
  let out = b;
  for (const y of Object.keys((b && b[listKey]) || {})) {
    out = withLines(out, listKey, y,
      lines(out, listKey, y).filter((l) => !atKey(l, labelField, key) && !alsoDrop(l)));
  }
  return out;
};

// Append the same new row to every rendered year so it spans all the columns.
const addRow = (b, listKey, years, template) => {
  const id = newRowId();
  return (years || []).reduce(
    (acc, y) => withLines(acc, listKey, y, [...lines(acc, listKey, y), { ...template, id }]),
    b);
};

// --- Equipment ---------------------------------------------------------------
export const equipRows = (b) => rowsOf(b, KEY_EQUIPMENT, 'item');
export const equipLine = (b, year, key) => lineAtKey(b, KEY_EQUIPMENT, 'item', year, key);
export const setEquipAmount = (b, year, key, amount) =>
  setRowAmount(b, KEY_EQUIPMENT, 'item', year, key, amount,
    { id: key.startsWith('label:') ? undefined : key, item: '', amount: 0 });
export const renameEquipRow = (b, key, label) => renameRow(b, KEY_EQUIPMENT, 'item', key, label);
export const dropEquipRow = (b, key) => dropRow(b, KEY_EQUIPMENT, 'item', key);
export const addEquipRow = (b, years) => addRow(b, KEY_EQUIPMENT, years, { item: '', amount: 0 });

// --- Other Expenses ----------------------------------------------------------
// A sub-row names its parent by the parent's key, so renaming a parent no longer
// has to drag its children's pointers along with it.
const parentOf = (l) => String((l && l.parent) || '').trim();

export const otherRows = (b) => rowsOf(b, KEY_OTHER, 'label', (l) => !parentOf(l));
export const otherSubRows = (b, parentKey) =>
  parentKey ? rowsOf(b, KEY_OTHER, 'label', (l) => parentOf(l) === parentKey) : [];

export const otherLine = (b, year, key) => lineAtKey(b, KEY_OTHER, 'label', year, key);
export const setOtherAmount = (b, year, key, parentKey, amount) =>
  setRowAmount(b, KEY_OTHER, 'label', year, key, amount,
    { id: key.startsWith('label:') ? undefined : key, label: '', parent: parentKey || '', amount: 0 });
export const renameOtherRow = (b, key, label) => renameRow(b, KEY_OTHER, 'label', key, label);
// Dropping a parent takes its sub-rows with it.
export const dropOtherRow = (b, key) =>
  dropRow(b, KEY_OTHER, 'label', key, (l) => parentOf(l) === key);
export const addOtherRow = (b, years, parentKey) =>
  addRow(b, KEY_OTHER, years, { label: '', parent: parentKey || '', amount: 0 });

export const otherSubTotal = (b, year, parentKey) =>
  otherLines(b, year)
    .filter((l) => parentKey && parentOf(l) === parentKey)
    .reduce((s, l) => s + (Number(l.amount) || 0), 0);

// A parent row "mismatches" when its sub-rows are filled but don't sum to it.
export const otherSubMismatch = (b, year, parentKey) => {
  const subs = otherSubTotal(b, year, parentKey);
  if (subs === 0) return false;
  const line = otherLine(b, year, parentKey);
  return subs !== Number((line && line.amount) || 0);
};

// One manpower category cell, defaulting to zeros when the year has no line
// for it yet. Fixed categories never need add/remove: the row always exists.
export const manpowerCell = (b, year, category) =>
  (((b && b[KEY_MANPOWER] && b[KEY_MANPOWER][year]) || [])
    .find((l) => String((l && l.category) || '').trim() === category)
    || { category, amount: 0 });

export const setManpowerCell = (b, year, category, field, value) => {
  const val = value === '' ? 0 : Number(value);
  const cur = lines(b, KEY_MANPOWER, year);
  const i = cur.findIndex((l) => String((l && l.category) || '').trim() === category);
  const next = i >= 0
    ? cur.map((l, j) => (j === i ? { ...l, [field]: val } : l))
    : [...cur, { category, amount: 0, [field]: val }];
  return withLines(b, KEY_MANPOWER, year, next);
};

// --- Other Expenses: renameable rows that may own sub-rows ----------------
// A line is top-level when its parent is blank; a sub-row names its parent.
// Labels are the identity here (same as Equipment), so renaming a parent has to
// carry its children across with it.

// Top-level expense labels, first-appearance order, plus at most one blank row
// so a freshly added, not-yet-named row still renders.
export const blankManpower = () => ({ category: '', amount: 0 });
export const blankEquipment = () => ({ item: '', amount: 0 });
export const blankOther = () => ({ label: '', amount: 0, parent: '' });
