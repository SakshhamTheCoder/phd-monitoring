import React from 'react';

/**
 * The buttons that finish a form. The primary action goes first (children);
 * `secondary` (Cancel, Reset, Back) is pushed to the right, away from it.
 */
const FormActions = ({ secondary, children }) => (
  <div className="form-actions">
    {children}
    {secondary && <div className="form-actions-secondary">{secondary}</div>}
  </div>
);

export default FormActions;
