import React, { useEffect } from 'react';
import CustomButton from '../forms/fields/CustomButton';
import { dismissRequestErrors } from '../../api/base';

/**
 * Stands in for a page's or panel's main data when loading it failed. A toast
 * alone was gone in three seconds and left an empty page that read as "there
 * is nothing here", which is a different answer from "we could not ask".
 *
 * `message` says what could not be loaded, e.g. "Could not load the leave
 * applications. Check your connection and try again."
 */
const LoadError = ({ message, onRetry }) => {
  // The request already toasted the failure; said here in place, the toast
  // only repeats it.
  useEffect(() => dismissRequestErrors(), []);

  return (
    <div className="status-notice status-notice--error load-error" role="alert">
      <i className="fa fa-exclamation-circle status-notice-icon" aria-hidden="true" />
      <p>{message}</p>
      {onRetry && <CustomButton text="Try again" variant="quiet" size="sm" onClick={onRetry} />}
    </div>
  );
};

export default LoadError;
