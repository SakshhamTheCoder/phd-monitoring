// Which tone a status or category gets. This replaced four copies of the same
// map living in four page components, each rendering an inline background and
// colour. Add a value here rather than styling a badge at the call site.
//
// Keyed by the literal value the API returns, so the pages need no translation.
const TONES = {
  // Project status
  'Active': 'success',
  'Completed': 'success',
  'Pending': 'warning',
  'On Hold': 'danger',

  // Project category. These are told apart by colour, so they spread across
  // the tones rather than meaning anything by them.
  'In-house': 'info',
  'Research': 'accent',
  'Consultancy': 'warning',
  'Industry': 'success',
  'International': 'purple',
  'Other': 'neutral',

  // Application status, in the order an application moves through them
  'Applied': 'info',
  'Shortlisted': 'warning',
  'Interview Scheduled': 'blue',
  'Selected': 'success',
  'Rejected': 'danger',

  // Milestone status
  'Not Started': 'neutral',
  'In Progress': 'warning',
  'Delayed': 'danger',

  // Position status
  'Open': 'success',
  'Closed': 'neutral',

  // Where a publication record came from
  'scopus': 'info',
  'orcid': 'success',
  'manual': 'neutral',
  'student': 'warning',
};

export const badgeTone = (value) => TONES[value] || 'neutral';

export const badgeClass = (value) => `badge badge--${badgeTone(value)}`;
