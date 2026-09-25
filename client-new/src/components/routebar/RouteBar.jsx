import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAccess } from '../../context/CapabilitiesContext';
import './RouteBar.css';

// Page names come from the server's menu for this role (GET /me), so a route is
// labelled once. Segments it does not know (an id, a form type) are title-cased
// from the URL.
const EXTRA_LABELS = {
  '/projects/create': 'New Project',
  '/forms/manage': 'Manage Forms',
  '/forms/urf-application': 'Apply for URF',
  '/forms/urf': 'URF',
  '/forms/urf-additional-info': 'Additional Information Form',
  '/forms/urf-half-yearly-report': 'Half-yearly Progress Report',
  '/forms/urf-final-report': 'Final Report',
  '/urf/urf-application': 'URF Application Form',
  '/urf/urf-additional-info': 'Additional Information Form',
  '/urf/urf-half-yearly-report': 'Half-yearly Progress Report',
  '/urf/urf-final-report': 'Final Report',
  '/areasOfSpecialization': 'Areas of Specialization',
  '/outside-experts': 'Outside Experts',
  // Reachable but not in the nav, so this is the only source of its name.
  '/supervisor-doctoral-approvals': 'Supervisor Approvals',
};

// A hand-typed URL can carry a malformed escape (/students/%E0), and a throw
// here would take the whole page down with it.
const decodeSegment = (segment) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
};

const labelFor = (labels, path, segment) =>
  labels[path]
  || EXTRA_LABELS[path]
  || decodeSegment(segment).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const RouteBar = () => {
  const { pathname } = useLocation();
  const { labels } = useAccess();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, i) => {
    const path = `/${segments.slice(0, i + 1).join('/')}`;
    return { path, label: labelFor(labels, path, segment) };
  });

  return (
    <nav className="route-bar" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/home">{labels['/home'] || 'Home'}</Link></li>
        {crumbs.map((crumb, i) => (
          <li key={crumb.path}>
            <span className="route-sep" aria-hidden="true">/</span>
            {i === crumbs.length - 1
              ? <span aria-current="page">{crumb.label}</span>
              : <Link to={crumb.path}>{crumb.label}</Link>}
          </li>
        ))}
      </ol>
    </nav>
  );
};

export default RouteBar;
