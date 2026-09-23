import React from 'react';
import CustomButton from '../forms/fields/CustomButton';

/**
 * Catches a render error, or a page chunk that no longer exists after a
 * deploy, so the app shows a way out instead of a blank screen. Reloading
 * fetches the current build, which is what fixes a stale chunk.
 */
class ErrorBoundary extends React.Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error('Render failed:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="empty-state load-error" role="alert">
        <p>This page could not be shown. Reload to try again.</p>
        <CustomButton text="Reload" variant="secondary" size="sm" onClick={() => window.location.reload()} />
      </div>
    );
  }
}

export default ErrorBoundary;
