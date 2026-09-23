import React from 'react';
import { Link } from 'react-router-dom';
import Page from '../../components/page/Page';
import StatusNotice from '../../components/common/StatusNotice';
// Signed out, nothing else has loaded the button styles the link borrows.
import '../../components/forms/fields/Fields.css';
import './NotFound.css';

// Signed in, this renders inside the shell, and an address can also miss
// because the role has no route for it rather than because it does not exist.
const NotFound = () => {
  const signedIn = !!localStorage.getItem('token');
  if (signedIn) {
    return (
      <Page title="Page not found">
        <StatusNotice
          tone="empty"
          title="404"
          action={<Link to="/home" className="custom-button">Home</Link>}
        >
          This page does not exist, or is not available for your role.
        </StatusNotice>
      </Page>
    );
  }
  return (
    <div className="not-found-container">
      <h1>404</h1>
      <p>Page not found</p>
      <Link to="/home" className="custom-button">Home</Link>
    </div>
  );
}

export default NotFound;
