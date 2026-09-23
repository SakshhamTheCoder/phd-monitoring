import React from 'react';
import Panel from '../../components/panel/Panel';

/**
 * The figures above an attendance table: a panel of label-over-value counts,
 * with the line saying what they cover as the panel's description. Present
 * and absent are coloured, but the label always says which is which.
 *
 * @param stats  [{ label, value, tone?: 'present' | 'absent', note? }]
 */
const AttendanceSummary = ({ title, caption, stats, children }) => (
  <Panel title={title} description={caption}>
    <dl className="facts attendance-stats">
      {stats.map(({ label, value, tone, note }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className={`attendance-stat-value${tone ? ` attendance-stat-value--${tone}` : ''}`}>{value}</dd>
          {note && <dd className="attendance-stat-note">{note}</dd>}
        </div>
      ))}
    </dl>
    {children}
  </Panel>
);

export default AttendanceSummary;
