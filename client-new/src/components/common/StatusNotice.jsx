import React from 'react';

const ICONS = {
  empty: 'fa-inbox',
  error: 'fa-exclamation-circle',
  info: 'fa-info-circle',
  warning: 'fa-exclamation-triangle',
};

/**
 * One look for empty, loading, error, info and warning. Styles live in
 * styles/ui.css.
 *
 *   <StatusNotice tone="empty" title="No forms submitted yet">
 *     Forms you submit appear here with their current stage.
 *   </StatusNotice>
 *
 * `loading` draws grey lines where the content will be. An error is announced
 * (role="alert"); the others are not, since they are not news.
 */
const StatusNotice = ({ tone = 'info', title, action, icon, children }) => {
  if (tone === 'loading') {
    return (
      <div className="status-notice status-notice--loading" aria-busy="true" aria-live="polite">
        <span className="sr-only">{title || 'Loading'}</span>
        <div className="skeleton-line" />
        <div className="skeleton-line" />
        <div className="skeleton-line" />
      </div>
    );
  }
  return (
    <div className={`status-notice status-notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}>
      <i className={`fa ${icon || ICONS[tone]} status-notice-icon`} aria-hidden="true" />
      <div className="status-notice-body">
        {title && <p className="status-notice-title">{title}</p>}
        {children && <div className="status-notice-text">{children}</div>}
        {action && <div className="status-notice-action">{action}</div>}
      </div>
    </div>
  );
};

export default StatusNotice;
