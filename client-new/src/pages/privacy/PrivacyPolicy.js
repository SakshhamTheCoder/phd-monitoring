import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

const PrivacyPolicy = () => {
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
            Privacy Policy for PhD Portal
          </h1>
          
          <p className="tw-text-sm tw-text-gray-600 tw-mb-8">
            Effective Date: December 1, 2025
          </p>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Introduction
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed">
              Welcome to phdportal.thapar.edu (the "Website"). We are committed to protecting your privacy 
              and ensuring that your personal information is handled in a safe and responsible manner. This 
              Privacy Policy outlines the types of information we collect from you, how we use it, how we 
              store it, and the steps we take to ensure it is protected in compliance with Google OAuth requirements.
            </p>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Information We Collect
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed tw-mb-3">
              When you use our Website and Google OAuth to sign in, we collect the following information:
            </p>
            <ul className="tw-list-disc tw-list-inside tw-text-gray-700 tw-space-y-2 tw-ml-4">
              <li><strong>Name:</strong> We collect your name as provided by your Google account.</li>
              <li><strong>Email Address:</strong> We collect your email address as provided by your Google account.</li>
              <li><strong>Profile Image:</strong> We collect your profile image as provided by your Google account.</li>
            </ul>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              How We Use Your Information
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed tw-mb-3">
              The information we collect is used for the following purposes:
            </p>
            <ul className="tw-list-disc tw-list-inside tw-text-gray-700 tw-space-y-2 tw-ml-4">
              <li><strong>Authentication:</strong> To authenticate your identity and provide you with access to our services.</li>
              <li><strong>Personalization:</strong> To personalize your experience on our Website.</li>
              <li><strong>Communication:</strong> To send you updates, notifications, and other information related to our services.</li>
            </ul>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Data Storage and Security
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed tw-mb-3">
              We take the security of your personal information seriously and implement appropriate technical 
              and organizational measures to protect it against unauthorized or unlawful processing and against 
              accidental loss, destruction, or damage.
            </p>
            <ul className="tw-list-disc tw-list-inside tw-text-gray-700 tw-space-y-2 tw-ml-4">
              <li><strong>Data Storage:</strong> Your data is stored securely on our servers and is only accessible by authorized personnel.</li>
              <li><strong>Encryption:</strong> We use industry-standard encryption to protect your data during transmission and storage.</li>
            </ul>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Sharing Your Information
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed">
              We do not share your personal information with third-party services except as necessary to provide 
              our services or as required by law. Your information is shared with Google OAuth for authentication purposes.
            </p>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Your Rights
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed tw-mb-3">
              You have the following rights regarding your personal information:
            </p>
            <ul className="tw-list-disc tw-list-inside tw-text-gray-700 tw-space-y-2 tw-ml-4">
              <li><strong>Access:</strong> You have the right to access the personal information we hold about you.</li>
              <li><strong>Correction:</strong> You have the right to correct any inaccuracies in your personal information.</li>
              <li><strong>Deletion:</strong> You have the right to request the deletion of your personal information, subject to legal and contractual restrictions.</li>
            </ul>
            <p className="tw-text-gray-700 tw-leading-relaxed tw-mt-3">
              To exercise these rights, please contact us at <a href="mailto:sbhagat_be23@thapar.edu" className="tw-text-brand hover:tw-underline tw-font-semibold">sbhagat_be23@thapar.edu</a>.
            </p>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Changes to This Privacy Policy
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed">
              We may update this Privacy Policy from time to time to reflect changes in our practices or legal 
              requirements. We will notify you of any significant changes by posting the new Privacy Policy on 
              our Website and updating the effective date at the top of this page.
            </p>
          </section>

          <section className="tw-mb-8">
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Contact Us
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed tw-mb-3">
              If you have any questions or concerns about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="tw-bg-gray-50 tw-p-6 tw-rounded-r-lg tw-border-l-4 tw-border-l-brand tw-shadow-sm tw-space-y-2">
              <p><strong>Email:</strong> <a href="mailto:sbhagat_be23@thapar.edu" className="tw-text-brand hover:tw-underline tw-font-semibold">sbhagat_be23@thapar.edu</a></p>
              <p><strong>Address:</strong> Thapar Institute of Engineering & Technology, Patiala</p>
            </div>
          </section>

          <section>
            <h2 className="tw-text-2xl tw-font-bold tw-text-gray-900 tw-mb-3 tw-border-l-4 tw-border-l-brand tw-pl-4">
              Links
            </h2>
            <p className="tw-text-gray-700 tw-leading-relaxed">
              Our Privacy Policy is available at the following locations:
            </p>
            <ul className="tw-list-disc tw-list-inside tw-text-gray-700 tw-space-y-2 tw-ml-4 tw-mt-2">
              <li>App Home Page</li>
              <li>The privacy policy URL linked to the OAuth consent screen on the Google Cloud Console matches the privacy policy link on our app homepage.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
