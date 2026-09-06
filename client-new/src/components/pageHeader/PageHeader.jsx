import React from 'react';

// The one page heading. Styles live in styles/ui.css so anything already using
// the .page-header markup renders identically.
const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-header">
    <div>
      <h1 className="page-title">{title}</h1>
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export default PageHeader;
