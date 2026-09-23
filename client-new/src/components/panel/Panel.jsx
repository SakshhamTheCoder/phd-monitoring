import React from 'react';

/**
 * The one surface for content. Styles live in styles/ui.css.
 *
 * With a `title` (or `actions`) it draws a head row of fixed minimum height,
 * so heads line up across a page whether or not they carry buttons. `flush`
 * drops the body padding for a table that runs edge to edge. `footer` is a row
 * under the body, for a pager or a total.
 *
 * Panels never nest: a titled region inside one is a PanelSection.
 */
const Panel = ({ title, description, actions, flush = false, footer, as: Tag = 'section', className = '', children, ...rest }) => {
  const hasHead = title || actions;
  return (
    <Tag className={`panel${flush ? ' panel--flush' : ''}${className ? ` ${className}` : ''}`} {...rest}>
      {hasHead && (
        <div className="panel-head">
          {(title || description) && (
            <div className="panel-head-text">
              {title && <h2 className="panel-title">{title}</h2>}
              {description && <p className="panel-description">{description}</p>}
            </div>
          )}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      <div className="panel-body">{children}</div>
      {footer && <div className="panel-foot">{footer}</div>}
    </Tag>
  );
};

/** A titled region inside a panel, divided from the next by a rule. */
export const PanelSection = ({ title, description, actions, className = '', children }) => (
  <section className={`panel-section${className ? ` ${className}` : ''}`}>
    {(title || actions) && (
      <div className="panel-section-head">
        <div>
          {title && <h3 className="panel-section-title">{title}</h3>}
          {description && <p className="panel-section-description">{description}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
    )}
    {children}
  </section>
);

export default Panel;
