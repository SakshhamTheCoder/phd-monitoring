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

const PrivacyPolicy = () => {
  return (
    <div className="public-page">
      <PublicPageBar />
      <main className="public-page-main">
        <Page
          title="Privacy policy for the Doctoral, Research and Innovation Management Portal"
          description="Effective date: December 1, 2025"
        >
          <Panel className="public-doc">
            <PanelSection title="Introduction">
              <p>
                Welcome to phdportal.thapar.edu (the "Website"). We are committed to protecting your privacy
                and ensuring that your personal information is handled in a safe and responsible manner. This
                Privacy Policy outlines the types of information we collect from you, how we use it, how we
                store it, and the steps we take to ensure it is protected in compliance with Google OAuth requirements.
              </p>
            </PanelSection>

            <PanelSection title="Information we collect">
              <p>When you use our Website and Google OAuth to sign in, we collect the following information:</p>
              <ul>
                <li><strong>Name:</strong> We collect your name as provided by your Google account.</li>
                <li><strong>Email address:</strong> We collect your email address as provided by your Google account.</li>
                <li><strong>Profile image:</strong> We collect your profile image as provided by your Google account.</li>
              </ul>
            </PanelSection>

            <PanelSection title="How we use your information">
              <p>The information we collect is used for the following purposes:</p>
              <ul>
                <li><strong>Authentication:</strong> To authenticate your identity and provide you with access to our services.</li>
                <li><strong>Personalization:</strong> To personalize your experience on our Website.</li>
                <li><strong>Communication:</strong> To send you updates, notifications, and other information related to our services.</li>
              </ul>
            </PanelSection>

            <PanelSection title="Data storage and security">
              <p>
                We take the security of your personal information seriously and implement appropriate technical
                and organizational measures to protect it against unauthorized or unlawful processing and against
                accidental loss, destruction, or damage.
              </p>
              <ul>
                <li><strong>Data storage:</strong> Your data is stored securely on our servers and is only accessible by authorized personnel.</li>
                <li><strong>Encryption:</strong> We use industry-standard encryption to protect your data during transmission and storage.</li>
              </ul>
            </PanelSection>

            <PanelSection title="Sharing your information">
              <p>
                We do not share your personal information with third-party services except as necessary to provide
                our services or as required by law. Your information is shared with Google OAuth for authentication purposes.
              </p>
            </PanelSection>

            <PanelSection title="Your rights">
              <p>You have the following rights regarding your personal information:</p>
              <ul>
                <li><strong>Access:</strong> You have the right to access the personal information we hold about you.</li>
                <li><strong>Correction:</strong> You have the right to correct any inaccuracies in your personal information.</li>
                <li><strong>Deletion:</strong> You have the right to request the deletion of your personal information, subject to legal and contractual restrictions.</li>
              </ul>
              <p>To exercise these rights, please contact us at <ContactEmails />.</p>
            </PanelSection>

            <PanelSection title="Changes to this privacy policy">
              <p>
                We may update this Privacy Policy from time to time to reflect changes in our practices or legal
                requirements. We will notify you of any significant changes by posting the new Privacy Policy on
                our Website and updating the effective date at the top of this page.
              </p>
            </PanelSection>

            <PanelSection title="Contact us">
              <p>If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:</p>
              <dl className="facts">
                <div>
                  <dt>Email</dt>
                  <dd><ContactEmails /></dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>Thapar Institute of Engineering &amp; Technology, Patiala</dd>
                </div>
              </dl>
            </PanelSection>

            <PanelSection title="Links">
              <p>Our Privacy Policy is available at the following locations:</p>
              <ul>
                <li>App Home Page</li>
                <li>The privacy policy URL linked to the OAuth consent screen on the Google Cloud Console matches the privacy policy link on our app homepage.</li>
              </ul>
            </PanelSection>
          </Panel>
        </Page>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
