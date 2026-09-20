import React from 'react';
import './CollapsibleSection.css';

/**
 * A section of a profile or a record that is worth having but not worth the
 * height it takes: publications, a progress chart. Closed until asked for, and
 * headed the way every other section on those pages is headed, so a shut one
 * still reads as part of the page rather than as a control bolted onto it.
 *
 * <details> rather than a button and a piece of state: the open and closed
 * markers, the keyboard handling and the accessible name come with the element.
 */
const CollapsibleSection = ({ title, count = null, children }) => (
  <details className="collapsible-section">
    <summary>
      {title}
      {count !== null && <span className="collapsible-count">{count}</span>}
    </summary>
    <div className="collapsible-body">{children}</div>
  </details>
);

export default CollapsibleSection;
