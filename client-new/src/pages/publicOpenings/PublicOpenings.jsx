import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import { apiPublicOpenings } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
import '../projects/Openings.css';

const skillList = (skills) =>
  (Array.isArray(skills) ? skills : String(skills || '').split(','))
    .map((s) => (typeof s === 'string' ? s.trim() : s))
    .filter(Boolean);

const PublicOpenings = () => {
  const navigate = useNavigate();
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    apiPublicOpenings().then(({ ok, body }) => {
      if (!active) return;
      if (ok) setOpenings(body || []);
      else setError(body.message || 'Could not load the openings. Please try again.');
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <ExternalLayout crumbs={[{ label: 'Openings' }]}>
      <div className="op-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">Openings</h1>
            <p className="page-subtitle">
              Research positions and internships at Thapar Institute. No account is needed to apply.
            </p>
          </div>
        </div>

        {loading && <p className="empty-state">Loading openings...</p>}
        {error && <p className="empty-state">{error}</p>}

        {!loading && !error && openings.length === 0 && (
          <p className="empty-state">
            There are no open positions right now. Check back later, or follow the
            department you are interested in for announcements.
          </p>
        )}

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
                <button className="op-apply-btn" onClick={() => navigate(`/openings/${pos.id}`)}>
                  <i className="fa fa-file-text-o"></i> View and apply
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </ExternalLayout>
  );
};

export default PublicOpenings;
