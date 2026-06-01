import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { getProjectById, positionTypes, sampleApplications } from '../../data/projectsData';
import { toast } from 'react-toastify';
import './ProjectRecruitment.css';

const ProjectRecruitment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = getProjectById(id);
  const [activeView, setActiveView] = useState('positions');
  const [showPostForm, setShowPostForm] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [posForm, setPosForm] = useState({
    type: '', title: '', openings: 1, eligibility: '', skills: '',
    cgpa: '', experience: '', stipend: '', startDate: '', endDate: '', deadline: '',
  });

  if (!project) {
    return <Layout><div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Project not found.</div></Layout>;
  }

  const appStats = {
    total: sampleApplications.length,
    shortlisted: sampleApplications.filter(a => a.status === 'Shortlisted').length,
    interview: sampleApplications.filter(a => a.status === 'Interview Scheduled').length,
    selected: sampleApplications.filter(a => a.status === 'Selected').length,
  };

  const appStatusColors = {
    Applied: { bg: '#e0e7ff', color: '#3730a3' },
    Shortlisted: { bg: '#fef3c7', color: '#92400e' },
    'Interview Scheduled': { bg: '#dbeafe', color: '#1e40af' },
    Selected: { bg: '#dcfce7', color: '#15803d' },
    Rejected: { bg: '#fee2e2', color: '#b91c1c' },
  };

  return (
    <Layout>
      <div className="pr-container">
        <button className="pr-back-link" onClick={() => navigate(`/projects/${id}`)}>
          <i className="fa fa-arrow-left"></i> BACK TO PROJECT
        </button>
        <div className="pr-header">
          <div>
            <h1 className="pr-title">Recruitment — {project.title.length > 50 ? project.title.slice(0, 50) + '...' : project.title}</h1>
            <p className="pr-subtitle">Manage positions and applications for this project.</p>
          </div>
          <button className="pr-post-btn" onClick={() => setShowPostForm(!showPostForm)}>
            <i className="fa fa-plus"></i> Post Opening
          </button>
        </div>

        {/* View Toggle */}
        <div className="pr-view-toggle">
          <button className={activeView === 'positions' ? 'active' : ''} onClick={() => setActiveView('positions')}>Open Positions</button>
          <button className={activeView === 'applications' ? 'active' : ''} onClick={() => setActiveView('applications')}>Applications</button>
        </div>

        {/* Post Opening Form */}
        {showPostForm && (
          <div className="pr-card pr-form-card">
            <h3 className="pr-card-title"><i className="fa fa-bullhorn"></i> Post New Opening</h3>
            <div className="pr-form-grid">
              <div className="pr-field">
                <label>Position Type *</label>
                <select value={posForm.type} onChange={e => setPosForm({...posForm, type: e.target.value})}>
                  <option value="">Select type</option>
                  {positionTypes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="pr-field">
                <label>Position Title *</label>
                <input type="text" value={posForm.title} onChange={e => setPosForm({...posForm, title: e.target.value})} placeholder="e.g. Junior Research Fellow — NAS Project" />
              </div>
              <div className="pr-field"><label>Number of Openings</label><input type="number" min="1" value={posForm.openings} onChange={e => setPosForm({...posForm, openings: e.target.value})} /></div>
              <div className="pr-field"><label>Eligibility</label><input type="text" value={posForm.eligibility} onChange={e => setPosForm({...posForm, eligibility: e.target.value})} placeholder="e.g. M.Tech in CS/ECE" /></div>
              <div className="pr-field"><label>Required Skills</label><input type="text" value={posForm.skills} onChange={e => setPosForm({...posForm, skills: e.target.value})} placeholder="e.g. Python, PyTorch, ML" /></div>
              <div className="pr-field"><label>Min CGPA</label><input type="text" value={posForm.cgpa} onChange={e => setPosForm({...posForm, cgpa: e.target.value})} placeholder="e.g. 7.5" /></div>
              <div className="pr-field"><label>Stipend</label><input type="text" value={posForm.stipend} onChange={e => setPosForm({...posForm, stipend: e.target.value})} placeholder="e.g. ₹31,000/month" /></div>
              <div className="pr-field"><label>Application Deadline</label><input type="date" value={posForm.deadline} onChange={e => setPosForm({...posForm, deadline: e.target.value})} /></div>
              <div className="pr-field"><label>Advertisement PDF</label><input type="file" accept=".pdf" /></div>
            </div>
            <div className="pr-form-actions">
              <button className="pr-btn-outline" onClick={() => setShowPostForm(false)}>Cancel</button>
              <button className="pr-btn-primary" onClick={() => { toast.success('Position published!'); setShowPostForm(false); }}>
                <i className="fa fa-paper-plane"></i> Publish Opening
              </button>
            </div>
          </div>
        )}

        {/* Positions View */}
        {activeView === 'positions' && (
          <>
            {project.positions.length > 0 ? (
              project.positions.map((pos, i) => (
                <div key={i} className="pr-card pr-position-card">
                  <div className="pr-pos-top">
                    <div>
                      <span className="pr-pos-type">{pos.type}</span>
                      <h3 className="pr-pos-title">{pos.title}</h3>
                    </div>
                    <span className="pr-pos-deadline"><i className="fa fa-calendar"></i> Deadline: {pos.deadline}</span>
                  </div>
                  <div className="pr-pos-stats">
                    <div className="pr-pos-stat"><span>Openings</span><strong>{pos.openings}</strong></div>
                    <div className="pr-pos-stat"><span>Stipend</span><strong>{pos.stipend}</strong></div>
                    <div className="pr-pos-stat"><span>Applicants</span><strong>{pos.applicants}</strong></div>
                    <div className="pr-pos-stat"><span>Shortlisted</span><strong>{pos.shortlisted}</strong></div>
                  </div>
                </div>
              ))
            ) : (
              <div className="pr-card pr-empty">No positions posted yet. Click "Post Opening" to create one.</div>
            )}
          </>
        )}

        {/* Applications View */}
        {activeView === 'applications' && (
          <>
            <div className="pr-app-stats">
              <div className="pr-app-stat"><span>Total Applications</span><strong>{appStats.total}</strong></div>
              <div className="pr-app-stat shortlisted"><span>Shortlisted</span><strong>{appStats.shortlisted}</strong></div>
              <div className="pr-app-stat interview"><span>Interview Scheduled</span><strong>{appStats.interview}</strong></div>
              <div className="pr-app-stat selected"><span>Selected</span><strong>{appStats.selected}</strong></div>
            </div>
            <div className="pr-card">
              <table className="pr-app-table">
                <thead>
                  <tr><th>Applicant Name</th><th>Position</th><th>Institute</th><th>CGPA</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {sampleApplications.map(app => (
                    <tr key={app.id}>
                      <td className="pr-app-name">{app.name}</td>
                      <td>{app.position}</td>
                      <td>{app.institute}</td>
                      <td>{app.cgpa}</td>
                      <td>
                        <span className="pr-app-badge" style={{ background: appStatusColors[app.status]?.bg, color: appStatusColors[app.status]?.color }}>{app.status}</span>
                      </td>
                      <td>
                        <button className="pr-view-btn" onClick={() => setSelectedApplicant(app)}><i className="fa fa-eye"></i> View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Applicant Modal */}
        {selectedApplicant && (
          <div className="pr-modal-overlay" onClick={() => setSelectedApplicant(null)}>
            <div className="pr-modal" onClick={e => e.stopPropagation()}>
              <button className="pr-modal-close" onClick={() => setSelectedApplicant(null)}><i className="fa fa-times"></i></button>
              <div className="pr-modal-header">
                <div className="pr-modal-avatar">{selectedApplicant.name.split(' ').map(n => n[0]).join('')}</div>
                <div>
                  <h2>{selectedApplicant.name}</h2>
                  <p>{selectedApplicant.degree} — {selectedApplicant.institute}</p>
                </div>
              </div>
              <div className="pr-modal-grid">
                <div className="pr-modal-item"><span>CGPA</span><strong>{selectedApplicant.cgpa}</strong></div>
                <div className="pr-modal-item"><span>Position</span><strong>{selectedApplicant.position}</strong></div>
                <div className="pr-modal-item"><span>Research Interest</span><strong>{selectedApplicant.research}</strong></div>
                <div className="pr-modal-item"><span>Skills</span><strong>{selectedApplicant.skills.join(', ')}</strong></div>
              </div>
              <div className="pr-modal-actions">
                <button className="pr-decision-btn shortlist"><i className="fa fa-star"></i> Shortlist</button>
                <button className="pr-decision-btn interview"><i className="fa fa-calendar"></i> Interview</button>
                <button className="pr-decision-btn select"><i className="fa fa-check"></i> Select</button>
                <button className="pr-decision-btn reject"><i className="fa fa-times"></i> Reject</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectRecruitment;
