import React from 'react';
import './Loader.css';

// `scope` says what the loader covers. Signed in, it is only ever the content
// area ("content"): the sidebar and top bar stay put, so a page does not flash
// between covering the whole screen and covering only itself. "screen" is for
// pages outside the shell and for the moment before the shell has loaded.
// "app" is the global request loader, which the shell takes over once it is
// on screen (see Loader.css).
const Loader = ({ scope = 'screen' }) => (
  <div className={`loader loader--${scope}`} role="status" aria-live="polite">
    <span className="sr-only">Loading</span>
    <div className="spinner" aria-hidden="true"></div>
  </div>
);

export default Loader;
