import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Loader from '../../components/loader/loader';

const GoogleCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Get the full URL with query parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if we have success data in the URL
    const token = urlParams.get('token');
    const userData = urlParams.get('user');
    const availableRoles = urlParams.get('available_roles');
    
    if (token && userData) {
      try {
        const user = JSON.parse(decodeURIComponent(userData));
        const roles = availableRoles ? JSON.parse(decodeURIComponent(availableRoles)) : [];
        
        // Send success message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_SUCCESS',
            token: token,
            user: user,
            available_roles: roles
          }, window.location.origin);
          
          // Close this popup window
          window.close();
        } else {
          // If not in popup, handle normally (fallback)
          localStorage.setItem('token', token);
          localStorage.setItem('userRole', user.role.role);
          localStorage.setItem('available_roles', JSON.stringify(roles));
          localStorage.setItem('user', JSON.stringify(user));
          navigate('/home');
        }
      } catch (error) {
        console.error('Error parsing Google auth response:', error);
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_AUTH_ERROR',
            error: 'Failed to process authentication response'
          }, window.location.origin);
          window.close();
        } else {
          navigate('/login');
        }
      }
    } else {
      // Check for error
      const error = urlParams.get('error');
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_AUTH_ERROR',
          error: error || 'Authentication failed'
        }, window.location.origin);
        window.close();
      } else {
        navigate('/login');
      }
    }
  }, [navigate]);

  return (
    <div className="tw-h-screen tw-flex tw-items-center tw-justify-center">
      <Loader />
      <p className="tw-text-center tw-text-gray-600 tw-mt-4">Completing sign in...</p>
    </div>
  );
};

export default GoogleCallback;
