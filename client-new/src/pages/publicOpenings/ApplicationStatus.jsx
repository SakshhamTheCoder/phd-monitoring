import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import { badgeClass } from '../../data/badges';
import { apiApplicationStatus, apiVerifyApplication } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
// Signed out, nothing else has loaded the button styles the error link borrows.
import '../../components/forms/fields/Fields.css';
import '../projects/Openings.css';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';

const ApplicationStatus = ({ verify = false }) => {
  const { token } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [justVerified, setJustVerified] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (verify) {
        const confirmed = await apiVerifyApplication(token);
        if (active && confirmed.ok) setJustVerified(true);
      }
      const { ok, body } = await apiApplicationStatus(token);
      if (!active) return;
      if (ok) setApplication(body);
      else setError(body.message || 'This link is not valid.');
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [token, verify]);

  return (
    <ExternalLayout crumbs={[{ label: 'Openings', to: '/openings' }, { label: 'Your application' }]}>
      <Page title="Your application" description="Where your application stands right now.">
        {loading && <Panel><StatusNotice tone="loading" title="Loading your application" /></Panel>}
        {error && (
          <Panel>
            <StatusNotice
              tone="error"
              action={<Link to="/openings" className="custom-button custom-button--quiet">See all open positions</Link>}
            >
              {error}
            </StatusNotice>
          </Panel>
        )}

        {application && (
          <Panel
            title={application.position_title}
            description={<><i className="fa fa-flask" aria-hidden="true"></i> {application.project_title}</>}
          >
            <div className="xr-stack">
              {justVerified && <p className="op-jd-text">Your email address is confirmed. Thank you.</p>}

              <dl className="facts">
                <div>
                  <dt>Status</dt>
                  <dd><span className={badgeClass(application.status)}>{application.status}</span></dd>
                </div>
                <div><dt>Applied on</dt><dd>{formatDate(application.applied_date)}</dd></div>
                <div><dt>Applicant</dt><dd>{application.name}</dd></div>
                <div>
                  <dt>Email</dt>
                  <dd>{application.verified ? 'Confirmed' : 'Not confirmed'}</dd>
                </div>
              </dl>

              {!application.verified && (
                <p className="op-jd-text">
                  Open the confirmation link we emailed you. Until then the principal
                  investigator sees this application marked as unconfirmed.
                </p>
              )}

              <p className="op-jd-text op-jd-muted">
                Keep this page bookmarked. It is the only way back to your application.
              </p>
            </div>
          </Panel>
        )}
      </Page>
    </ExternalLayout>
  );
};

export default ApplicationStatus;
