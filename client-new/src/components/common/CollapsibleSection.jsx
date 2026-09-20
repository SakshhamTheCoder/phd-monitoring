import React from 'react';
import './CollapsibleSection.css';

/**
 * A section of a profile or a record that is worth having but not worth the
 * height it takes. Closed until asked for, and headed the way every other
 * section on those pages is headed, so a shut one still reads as part of the
 * page rather than as a control bolted onto it.
 *
 * <details> rather than a button and a piece of state: the keyboard handling
 * and the expanded state a screen reader announces come with the element. The
 * Show and Hide labels are the same two classes every other button in the
 * product wears, and swap on [open] in CSS rather than on a render.
 */
const CollapsibleSection = ({ title, count = null, children }) => (
  <details className="collapsible-section">
    <summary>
      <span className="collapsible-title">
        {title}
        {count !== null && <span className="collapsible-count">{count}</span>}
      </span>
      <span className="custom-button custom-button--secondary custom-button--sm">
        <span className="collapsible-show">Show</span>
        <span className="collapsible-hide">Hide</span>
      </span>
    </summary>
    <div className="collapsible-body">{children}</div>
  </details>
);

export default CollapsibleSection;
