import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { buttonConfig } from '../navbar/CustomNavBar';
import './RouteBar.css';

// Page names come from the nav config, so a route is labelled once. Segments the
// nav does not know about (an id, a form type) are title-cased from the URL.
const NAV_LABELS = buttonConfig.reduce((map, item) => {
  map[item.path] = item.text;
  return map;
}, {});

const EXTRA_LABELS = {
  '/projects/create': 'New Project',
  '/forms/manage': 'Manage Forms',
  '/research-profile': 'Research Profile',
  '/areasOfSpecialization': 'Areas of Specialization',
  '/outside-experts': 'Outside Experts',
  // Reachable but not in the nav, so this is the only source of its name.
  '/supervisor-doctoral-approvals': 'Supervisor Approvals',
};

const labelFor = (path, segment) =>
  NAV_LABELS[path]
  || EXTRA_LABELS[path]
  || decodeURIComponent(segment).replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const RouteBar = () => {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  const crumbs = segments.map((segment, i) => {
    const path = `/${segments.slice(0, i + 1).join('/')}`;
    return { path, label: labelFor(path, segment) };
  });

  return (
    <nav className="route-bar" aria-label="Breadcrumb">
      <ol>
        <li><Link to="/home">Home</Link></li>
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
