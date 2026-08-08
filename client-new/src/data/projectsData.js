// Shared constants and helpers for the Projects module.

export const categoryOptions = [
  'In-house', 'Research', 'Consultancy', 'Industry', 'International', 'Other'
];

export const roleOptions = ['PI', 'Co-PI'];

export const milestoneStatusOptions = ['Not Started', 'In Progress', 'Completed', 'Delayed'];

export const positionTypes = [
  'JRF', 'SRF', 'Research Associate', 'Research Intern', 'UG Intern', 'PG Intern'
];

export const budgetHeadTemplate = [
  { head: 'Manpower', subItems: ['PhD Scholar', 'JRF', 'SRF', 'Intern'] },
  { head: 'Travel', subItems: ['Domestic', 'International'] },
  { head: 'Equipment', subItems: ['Laptop', 'Smartphone', 'Sensors', 'Printer'] },
  { head: 'Contingency', subItems: [] },
  { head: 'Overhead', subItems: [] },
];

export const filterProjects = (projects, filter) => {
  if (filter === 'All') return projects;
  if (['Active', 'Completed', 'Pending'].includes(filter)) return projects.filter(p => p.status === filter);
  return projects.filter(p => p.category === filter);
};

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
// A head "mismatches" when it has sub-items entered whose sum differs from the
// head amount. Shared so the create wizard and the details page agree.
export const subVal = (b, year, head, sub) =>
  Number(b && b.__subitems && b.__subitems[year] && b.__subitems[year][head] ? (b.__subitems[year][head][sub] || 0) : 0);

export const subSum = (b, year, head) => {
  const tmpl = budgetHeadTemplate.find(t => t.head === head);
  if (!tmpl || !tmpl.subItems.length) return 0;
  return tmpl.subItems.reduce((s, sub) => s + subVal(b, year, head, sub), 0);
};

export const cellMismatch = (b, year, head) => {
  const ss = subSum(b, year, head);
  return ss > 0 && ss !== Number(b[year] ? (b[year][head] || 0) : 0);
};

export const budgetMismatches = (b) => {
  const out = [];
  Object.keys(b || {}).filter(k => k !== '__subitems').forEach(year => {
    budgetHeadTemplate.forEach(t => { if (t.subItems.length && cellMismatch(b, year, t.head)) out.push(t.head); });
  });
  return [...new Set(out)];
};

export const setSubCell = (budget, year, head, sub, value) => {
  const subs = { ...(budget.__subitems || {}) };
  const ys = { ...(subs[year] || {}) };
  const hs = { ...(ys[head] || {}) };
  hs[sub] = value === '' ? 0 : Number(value);
  ys[head] = hs;
  subs[year] = ys;
  return { ...budget, __subitems: subs };
};
