import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import { apiPublicOpenings } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
import '../projects/Openings.css';

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
    <ExternalLayout
      heading="Research Openings"
      subheading="Positions currently open at Thapar Institute. No account is needed to apply."
    >
      <div className="op-container">
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
              <div className="op-meta">
                {pos.stipend && <span><i className="fa fa-inr"></i> {pos.stipend}</span>}
                {pos.pi_name && <span><i className="fa fa-user"></i> {pos.pi_name}</span>}
                {pos.pi_department && <span><i className="fa fa-building-o"></i> {pos.pi_department}</span>}
              </div>
              <div className="op-card-actions">
                <button className="op-apply-btn" onClick={() => navigate(`/careers/${pos.id}`)}>
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
