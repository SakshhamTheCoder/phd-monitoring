import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import { apiPublicOpenings } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
import '../projects/Openings.css';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import LoadError from '../../components/common/LoadError';
import CustomButton from '../../components/forms/fields/CustomButton';

const skillList = (skills) =>
  (Array.isArray(skills) ? skills : String(skills || '').split(','))
    .map((s) => (typeof s === 'string' ? s.trim() : s))
    .filter(Boolean);

const PublicOpenings = () => {
  const navigate = useNavigate();
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiPublicOpenings().then(({ ok, body }) => {
      if (!active) return;
      if (ok) setOpenings(body || []);
      else setError(body.message || 'Could not load the openings. Please try again.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  return (
    <ExternalLayout crumbs={[{ label: 'Openings' }]}>
      <Page
        title="Openings"
        description="Research positions and internships at Thapar Institute. No account is needed to apply."
      >
        {loading && <Panel><StatusNotice tone="loading" title="Loading openings" /></Panel>}
        {error && <LoadError message={error} onRetry={() => setAttempt((n) => n + 1)} />}

        {!loading && !error && openings.length === 0 && (
          <Panel>
            <StatusNotice tone="empty" title="There are no open positions right now">
              Check back later, or follow the department you are interested in for announcements.
            </StatusNotice>
          </Panel>
        )}

        {openings.length > 0 && (
          <div className="op-grid">
            {openings.map((pos) => (
              <div key={pos.id} className="op-card">
                <div className="op-card-top">
                  <div className="op-card-head">
                    <span className="op-type">{pos.type}</span>
                    <h3 className="op-title">{pos.title}</h3>
                    <p className="op-project"><i className="fa fa-flask"></i> {pos.project_title}</p>
                  </div>
                  {pos.deadline && (
                    <span className="op-deadline">
                      <i className="fa fa-calendar"></i> Apply by {formatDate(pos.deadline)}
                    </span>
                  )}
                </div>
                {pos.description && <p className="op-desc">{pos.description}</p>}
                <div className="op-meta">
                  {pos.stipend && <span><i className="fa fa-inr"></i> {pos.stipend}</span>}
                  {pos.eligibility && <span><i className="fa fa-graduation-cap"></i> {pos.eligibility}</span>}
                  {pos.min_cgpa && <span><i className="fa fa-star-o"></i> Min CGPA {pos.min_cgpa}</span>}
                  {pos.openings != null && <span><i className="fa fa-users"></i> {pos.openings} opening(s)</span>}
                  {pos.pi_name && <span><i className="fa fa-user"></i> {pos.pi_name}, {pos.pi_department}</span>}
                </div>
                {skillList(pos.skills).length > 0 && (
                  <div className="op-skills">
                    {skillList(pos.skills).map((s, i) => <span key={i} className="op-skill">{s}</span>)}
                  </div>
                )}
                <div className="op-card-actions">
                  {/* Outlined: a filled button on every card put a dozen primaries on one page. */}
                  <CustomButton
                    text="View and apply"
                    variant="secondary"
                    className="custom-button--block"
                    onClick={() => navigate(`/openings/${pos.id}`)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Page>
    </ExternalLayout>
  );
};

export default PublicOpenings;
