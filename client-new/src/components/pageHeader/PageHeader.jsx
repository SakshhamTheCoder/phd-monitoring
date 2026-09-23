import React from 'react';

// The one page heading: title, one-line description, actions on the right,
// and optional meta (badges, ids) and tabs under it. Styles live in
// styles/ui.css. Most pages reach it through components/page/Page.
const PageHeader = ({ title, subtitle, description, meta, actions, tabs }) => {
  const text = description ?? subtitle;
  return (
    <div className="page-header">
      <div className="page-header-main">
        <div className="page-header-text">
          <h1 className="page-title">{title}</h1>
          {text && <p className="page-subtitle">{text}</p>}
          {meta && <div className="page-meta">{meta}</div>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
      {tabs}
    </div>
  );
};

export default PageHeader;
