import React from 'react';
import PublicPageBar from '../../components/publicPageBar/PublicPageBar';
import Page from '../../components/page/Page';
import Panel, { PanelSection } from '../../components/panel/Panel';

const ContactEmails = () => (
  <>
    <a href="mailto:tarunpreet@thapar.edu">tarunpreet@thapar.edu</a> or{' '}
    <a href="mailto:sbhagat_be23@thapar.edu">sbhagat_be23@thapar.edu</a>
  </>
);

const Support = () => {
  return (
    <div className="public-page">
      <PublicPageBar />
      <main className="public-page-main">
        <Page
          title="Support and help"
          description="Need assistance with the Doctoral, Research and Innovation Management Portal? We're here to help!"
        >
          <Panel className="public-doc">
            <PanelSection title="Contact information">
              <dl className="facts">
                <div>
                  <dt>Email support</dt>
                  <dd>
                    For technical support and general inquiries:<br />
                    <ContactEmails />
                  </dd>
                </div>
                <div>
                  <dt>Office address</dt>
                  <dd>
                    Dean of Research &amp; Doctoral Committee<br />
                    Thapar Institute of Engineering &amp; Technology<br />
                    Patiala - 147004, Punjab, India
                  </dd>
                </div>
              </dl>
            </PanelSection>

            <PanelSection title="Frequently asked questions">
              <dl className="public-faq">
                <dt>How do I login to the portal?</dt>
                <dd>
                  You can login using your Thapar email credentials or use the "Sign in with Google"
                  button to sign in with your Google account.
                </dd>

                <dt>I forgot my password. What should I do?</dt>
                <dd>
                  Click on the "Forgot password?" link on the login page and follow the instructions
                  to reset your password. You'll receive a reset link via email.
                </dd>

                <dt>Can I login with Google if I don't have a portal account?</dt>
                <dd>
                  No, only users who have been registered in the system by the administrator can login.
                  If you don't have access, please contact the support team.
                </dd>

                <dt>Who can I contact for account-related issues?</dt>
                <dd>
                  For account creation, access issues, or role-related queries, please email <ContactEmails />
                </dd>

                <dt>How do I submit my research progress reports?</dt>
                <dd>
                  After logging in, navigate to the Forms section from your dashboard. Select the
                  appropriate form type and fill in the required details. Make sure to upload all
                  necessary documents before submission.
                </dd>
              </dl>
            </PanelSection>

            <PanelSection title="Technical issues">
              <p>If you're experiencing technical difficulties or have found a bug, please send us an email with:</p>
              <ul>
                <li>A detailed description of the issue</li>
                <li>Screenshots (if applicable)</li>
                <li>The browser and device you're using</li>
                <li>Steps to reproduce the problem</li>
              </ul>
            </PanelSection>

            <PanelSection title="Office hours">
              <dl className="facts">
                <div>
                  <dt>Monday - Friday</dt>
                  <dd>9:00 AM - 5:00 PM</dd>
                </div>
                <div>
                  <dt>Saturday - Sunday</dt>
                  <dd>Closed</dd>
                </div>
              </dl>
              <p className="public-doc-note">
                Response time may vary. We strive to respond to all queries within 24-48 hours during business days.
              </p>
            </PanelSection>
          </Panel>
        </Page>
      </main>
    </div>
  );
};

export default Support;
