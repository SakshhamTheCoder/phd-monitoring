import React from 'react';
import '../profileCard/ProfileCard.css';
import { EMPTY_VALUE } from '../../utils/timeParse';

export const URF_STATUSES = ['applied', 'selected', 'rejected'];
export const REPORT_TYPES = { half_yearly: 'Half-yearly Progress Report', final: 'Final Report' };

export const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');

// Plain text, as statuses read elsewhere in the portal.
export const StatusText = ({ status }) => <span>{capitalize(status)}</span>;

// One "Label: value" line under a profile's name, as the PhD profile writes them.
export const HeaderLine = ({ label, children, title = false }) => (
  <p className={title ? 'student-research-title' : undefined}>
    <span className="student-research-label">{label}:</span>{' '}
    {children ?? <span className="student-value-empty">{EMPTY_VALUE}</span>}
  </p>
);
