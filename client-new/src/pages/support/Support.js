import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="tw-min-h-screen tw-bg-white tw-flex tw-flex-col">
      <nav className="page-navbar">
        <div className="nav-container tw-max-w-4xl">
          <button 
            onClick={() => navigate(-1)} 
            className="back-button"
          >
            ← Back
          </button>
          <Link 
            to="/" 
            className="nav-home-link"
          >
            Home
          </Link>
        </div>
      </nav>
      <div className="tw-flex-1 tw-py-8 tw-px-4">
        <div className="tw-max-w-4xl tw-mx-auto tw-p-2 tw-w-full">
          
          <h1 className="tw-text-4xl tw-font-bold tw-text-gray-900 tw-mb-4">
            Support & Help
          </h1>
          
          <p className="tw-text-gray-600 tw-mb-8 tw-leading-relaxed">
            Need assistance with the PhD Portal? We're here to help!
          </p>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-4 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Contact Information
            </h2>
            <div className="tw-bg-gray-50 tw-p-6 tw-rounded-r-lg tw-border-l-4 tw-border-l-brand tw-shadow-sm tw-space-y-4">
              <div>
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">Email Support</h3>
                <p className="tw-text-gray-700">
                  For technical support and general inquiries: <br/>
                  <a href="mailto:sbhagat_be23@thapar.edu" className="tw-text-brand hover:tw-underline tw-font-semibold">
                    sbhagat_be23@thapar.edu
                  </a>
                </p>
              </div>
              
              <div className="tw-border-t tw-border-gray-200 tw-pt-4">
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">Office Address</h3>
                <p className="tw-text-gray-700">
                  Dean of Research & Doctoral Committee<br/>
                  Thapar Institute of Engineering & Technology<br/>
                  Patiala - 147004, Punjab, India
                </p>
              </div>
            </div>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-4 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Frequently Asked Questions
            </h2>
            
            <div className="tw-space-y-4">
              <div className="tw-border-l-4 tw-border-brand tw-pl-4">
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">
                  How do I login to the portal?
                </h3>
                <p className="tw-text-gray-700">
                  You can login using your Thapar email credentials or use the "Login with Thapar ID" 
                  button to sign in with your Google account.
                </p>
              </div>

              <div className="tw-border-l-4 tw-border-brand tw-pl-4">
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">
                  I forgot my password. What should I do?
                </h3>
                <p className="tw-text-gray-700">
                  Click on the "Forgot Password?" link on the login page and follow the instructions 
                  to reset your password. You'll receive a reset link via email.
                </p>
              </div>

              <div className="tw-border-l-4 tw-border-brand tw-pl-4">
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">
                  Can I login with Google if I don't have a portal account?
                </h3>
                <p className="tw-text-gray-700">
                  No, only users who have been registered in the system by the administrator can login. 
                  If you don't have access, please contact the support team.
                </p>
              </div>

              <div className="tw-border-l-4 tw-border-brand tw-pl-4">
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">
                  Who can I contact for account-related issues?
                </h3>
                <p className="tw-text-gray-700">
                  For account creation, access issues, or role-related queries, please email 
                  <a href="mailto:sbhagat_be23@thapar.edu" className="tw-text-brand hover:tw-underline tw-font-semibold tw-ml-1">
                    sbhagat_be23@thapar.edu
                  </a>
                </p>
              </div>

              <div className="tw-border-l-4 tw-border-brand tw-pl-4">
                <h3 className="tw-font-bold tw-text-gray-900 tw-mb-2">
                  How do I submit my research progress reports?
                </h3>
                <p className="tw-text-gray-700">
                  After logging in, navigate to the Forms section from your dashboard. Select the 
                  appropriate form type and fill in the required details. Make sure to upload all 
                  necessary documents before submission.
                </p>
              </div>
            </div>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-4 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Technical Issues
            </h2>
            <div className="tw-bg-blue-50 tw-border-l-4 tw-border-blue-500 tw-p-4 tw-rounded-r-lg tw-shadow-sm">
              <p className="tw-text-gray-700">
                If you're experiencing technical difficulties or have found a bug, please send us an email with:
              </p>
              <ul className="tw-list-disc tw-list-inside tw-text-gray-700 tw-mt-2 tw-space-y-1 tw-ml-4">
                <li>A detailed description of the issue</li>
                <li>Screenshots (if applicable)</li>
                <li>The browser and device you're using</li>
                <li>Steps to reproduce the problem</li>
              </ul>
            </div>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-4 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Office Hours
            </h2>
            <div className="tw-bg-gray-50 tw-p-6 tw-rounded-r-lg tw-border-l-4 tw-border-l-brand tw-shadow-sm">
              <p className="tw-text-gray-700">
                <strong>Monday - Friday:</strong> 9:00 AM - 5:00 PM<br/>
                <strong>Saturday - Sunday:</strong> Closed
              </p>
              <p className="tw-text-sm tw-text-gray-600 tw-mt-3 tw-italic">
                * Response time may vary. We strive to respond to all queries within 24-48 hours during business days.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Support;
