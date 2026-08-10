import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import { badgeClass } from '../../data/badges';
import { apiApplicationStatus, apiVerifyApplication } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
import '../projects/Openings.css';

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
      <div className="op-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Your application</h1>
            <p className="page-subtitle">Where your application stands right now.</p>
          </div>
        </div>

        {loading && <p className="empty-state">Loading...</p>}
        {error && (
          <>
            <p className="empty-state">{error}</p>
            <p className="empty-state"><Link to="/openings">See all open positions</Link></p>
          </>
        )}

        {application && (
          <div className="card">
            {justVerified && <p className="op-jd-text">Your email address is confirmed. Thank you.</p>}

            <h3 className="section-heading">{application.position_title}</h3>
            <p className="op-jd-project"><i className="fa fa-flask"></i> {application.project_title}</p>

            <div className="op-jd-facts">
              <div className="op-jd-fact">
                <span>Status</span>
                <strong><span className={badgeClass(application.status)}>{application.status}</span></strong>
              </div>
              <div className="op-jd-fact"><span>Applied on</span><strong>{formatDate(application.applied_date)}</strong></div>
              <div className="op-jd-fact"><span>Applicant</span><strong>{application.name}</strong></div>
              <div className="op-jd-fact">
                <span>Email</span>
                <strong>{application.verified ? 'Confirmed' : 'Not confirmed'}</strong>
              </div>
            </div>

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
        )}
      </div>
    </ExternalLayout>
  );
};

export default ApplicationStatus;
