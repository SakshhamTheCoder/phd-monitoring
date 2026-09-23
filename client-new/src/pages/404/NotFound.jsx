import React from 'react';
import { Link } from 'react-router-dom';
import './NotFound.css';

// Signed in, this renders inside the shell, and an address can also miss
// because the role has no route for it rather than because it does not exist.
const NotFound = () => {
  const signedIn = !!localStorage.getItem('token');
  return (
    <div className={`not-found-container${signedIn ? ' not-found-container--shell' : ''}`}>
      <div className="not-found-box">
        <h1>404</h1>
        <p>{signedIn ? 'This page does not exist, or is not available for your role.' : 'Page Not Found'}</p>
        <Link to="/home" className="back-link">Home</Link>
      </div>
    </div>
  );
}

export default NotFound;
