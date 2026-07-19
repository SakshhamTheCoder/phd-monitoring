import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { positionTypes, formatDate } from '../../data/projectsData';
import { apiGetProject, apiListPositions, apiAddPosition, apiUpdatePosition, apiDeletePosition, apiListApplications, apiSetApplicationStatus } from '../../api/projects';
import { toast } from 'react-toastify';
import './ProjectRecruitment.css';

const emptyPos = {
  type: '', title: '', openings: 1, eligibility: '', skills: '',
  cgpa: '', experience: '', stipend: '', startDate: '', endDate: '', deadline: '', description: '',
};

// Map the post-opening form to the backend position body.
const toPositionBody = (f) => ({
  type: f.type, title: f.title, openings: Number(f.openings) || 1,
  stipend: f.stipend || '', deadline: f.deadline || null,
  eligibility: f.eligibility || '', skills: f.skills || '',
  min_cgpa: f.cgpa || '', description: f.description || '',
});

const ProjectRecruitment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPosIdx, setEditingPosIdx] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [posForm, setPosForm] = useState(emptyPos);
  const [positions, setPositions] = useState([]);
  const [applications, setApplications] = useState([]);

  const loadAll = async () => {
    const [p, pos, apps] = await Promise.all([apiGetProject(id), apiListPositions(id), apiListApplications(id)]);
    setProject(p); setPositions(pos); setApplications(apps); setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, [id]);

  if (loading) {
    return <Layout><div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Loading…</div></Layout>;
  }
  if (!project) {
    return <Layout><div style={{ textAlign: 'center', padding: '4rem', color: '#999' }}>Project not found.</div></Layout>;
  }

  // Applications for the currently-opened position.
  const posApps = selectedPosition ? applications.filter(a => a.posKey === selectedPosition.id) : [];
  const appStats = {
    total: posApps.length,
    shortlisted: posApps.filter(a => a.status === 'Shortlisted').length,
    interview: posApps.filter(a => a.status === 'Interview Scheduled').length,
    selected: posApps.filter(a => a.status === 'Selected').length,
  };

  const appStatusColors = {
    Applied: { bg: '#e0e7ff', color: '#3730a3' },
    Shortlisted: { bg: '#fef3c7', color: '#92400e' },
    'Interview Scheduled': { bg: '#dbeafe', color: '#1e40af' },
    Selected: { bg: '#dcfce7', color: '#15803d' },
    Rejected: { bg: '#fee2e2', color: '#b91c1c' },
  };

  // ---- Position CRUD ----
  const openAddPos = () => { setSelectedPosition(null); setEditingPosIdx(null); setPosForm(emptyPos); setShowPostForm(true); };
  const openEditPos = (i) => {
    setEditingPosIdx(i);
    setPosForm({ ...emptyPos, ...positions[i] });
    setShowPostForm(true);
  };
  const closePostForm = () => { setShowPostForm(false); setEditingPosIdx(null); setPosForm(emptyPos); };
  const publishPosition = async () => {
    if (!posForm.type) { toast.error('Please select a position type.'); return; }
    if (!posForm.title.trim()) { toast.error('Position title is required.'); return; }
    const body = toPositionBody(posForm);
    const res = editingPosIdx !== null
      ? await apiUpdatePosition(project.id, positions[editingPosIdx].id, body)
      : await apiAddPosition(project.id, body);
    if (res.success) {
      setPositions(await apiListPositions(project.id));
      toast.success(editingPosIdx !== null ? 'Position updated!' : 'Position published!');
      closePostForm();
    }
  };
  const deletePosition = async (i) => {
    const res = await apiDeletePosition(project.id, positions[i].id);
    if (res.success) { setPositions(prev => prev.filter((_, idx) => idx !== i)); toast.success('Position deleted.'); }
  };

  // ---- Application decisions ----
  const setAppStatus = async (newStatus) => {
    const res = await apiSetApplicationStatus(selectedApplicant.id, newStatus);
    if (res.success) {
      setApplications(prev => prev.map(a => (a.id === selectedApplicant.id ? { ...a, status: newStatus } : a)));
      setSelectedApplicant({ ...selectedApplicant, status: newStatus });
      toast.success(`Marked as ${newStatus}.`);
    }
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
          <button className="pr-post-btn" onClick={() => (showPostForm ? closePostForm() : openAddPos())}>
            <i className="fa fa-plus"></i> Post Opening
          </button>
        </div>

        {/* Post / Edit Opening Form */}
        {showPostForm && (
          <div className="pr-card pr-form-card">
            <h3 className="pr-card-title"><i className="fa fa-bullhorn"></i> {editingPosIdx !== null ? 'Edit Opening' : 'Post New Opening'}</h3>
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
              <div className="pr-field full"><label>Job Description</label><textarea rows="4" value={posForm.description} onChange={e => setPosForm({...posForm, description: e.target.value})} placeholder="Describe the role, responsibilities, and what the candidate will work on — this is shown to students on the Openings portal." /></div>
            </div>
            <div className="pr-form-actions">
              <button className="pr-btn-outline" onClick={closePostForm}>Cancel</button>
              <button className="pr-btn-primary" onClick={publishPosition}>
                <i className="fa fa-paper-plane"></i> {editingPosIdx !== null ? 'Save Changes' : 'Publish Opening'}
              </button>
            </div>
          </div>
        )}

        {/* Open Positions — click a card to see its applications */}
        {!selectedPosition && !showPostForm && (
          <>
            <h3 className="pr-section-heading">Open Positions</h3>
            {positions.length > 0 ? (
              positions.map((pos, i) => (
                <div key={i} className="pr-card pr-position-card pr-position-clickable" onClick={() => setSelectedPosition(pos)}>
                  <div className="pr-pos-top">
                    <div>
                      <span className="pr-pos-type">{pos.type}</span>
                      <h3 className="pr-pos-title">{pos.title}</h3>
                    </div>
                    <div className="pr-pos-top-right">
                      <span className="pr-pos-deadline"><i className="fa fa-calendar"></i> Deadline: {pos.deadline ? formatDate(pos.deadline) : '—'}</span>
                      <div className="pr-pos-actions">
                        <button className="pr-pos-edit" onClick={(e) => { e.stopPropagation(); openEditPos(i); }} title="Edit position"><i className="fa fa-pencil"></i></button>
                        <button className="pr-pos-delete" onClick={(e) => { e.stopPropagation(); deletePosition(i); }} title="Delete position"><i className="fa fa-trash"></i></button>
                      </div>
                    </div>
                  </div>
                  <div className="pr-pos-stats">
                    <div className="pr-pos-stat"><span>Openings</span><strong>{pos.openings}</strong></div>
                    <div className="pr-pos-stat"><span>Stipend</span><strong>{pos.stipend || '—'}</strong></div>
                    <div className="pr-pos-stat"><span>Applicants</span><strong>{pos.applicants ?? 0}</strong></div>
                    <div className="pr-pos-stat"><span>Shortlisted</span><strong>{pos.shortlisted ?? 0}</strong></div>
                  </div>
                  <div className="pr-pos-view-hint"><i className="fa fa-users"></i> View applications <i className="fa fa-arrow-right"></i></div>
                </div>
              ))
            ) : (
              <div className="pr-card pr-empty">No positions posted yet. Click "Post Opening" to create one.</div>
            )}
          </>
        )}

        {/* Applications for the opened position */}
        {selectedPosition && (
          <>
            <button className="pr-back-to-positions" onClick={() => setSelectedPosition(null)}>
              <i className="fa fa-arrow-left"></i> Back to positions
            </button>
            <h3 className="pr-section-heading">Applications — {selectedPosition.title}</h3>
            <div className="pr-app-stats">
              <div className="pr-app-stat"><span>Total Applications</span><strong>{appStats.total}</strong></div>
              <div className="pr-app-stat shortlisted"><span>Shortlisted</span><strong>{appStats.shortlisted}</strong></div>
              <div className="pr-app-stat interview"><span>Interview Scheduled</span><strong>{appStats.interview}</strong></div>
              <div className="pr-app-stat selected"><span>Selected</span><strong>{appStats.selected}</strong></div>
            </div>
            <div className="pr-card">
              {posApps.length > 0 ? (
                <table className="pr-app-table">
                  <thead>
                    <tr><th>Applicant Name</th><th>Position</th><th>Institute</th><th>CGPA</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {posApps.map(app => (
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
              ) : (
                <div className="pr-empty" style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No applications for this position yet.</div>
              )}
            </div>
          </>
        )}

        {/* Applicant Detail Modal */}
        {selectedApplicant && (
          <div className="pr-modal-overlay" onClick={() => setSelectedApplicant(null)}>
            <div className="pr-modal" onClick={e => e.stopPropagation()}>
              <button className="pr-modal-close" onClick={() => setSelectedApplicant(null)}><i className="fa fa-times"></i></button>
              <div className="pr-modal-header">
                <div className="pr-modal-avatar">{selectedApplicant.name.split(' ').map(n => n[0]).join('')}</div>
                <div>
                  <h2>{selectedApplicant.name}</h2>
                  <p>{selectedApplicant.degree} — {selectedApplicant.institute}</p>
                  <span className="pr-app-badge" style={{ background: appStatusColors[selectedApplicant.status]?.bg, color: appStatusColors[selectedApplicant.status]?.color }}>{selectedApplicant.status}</span>
                </div>
              </div>
              <div className="pr-modal-grid">
                <div className="pr-modal-item"><span>Email</span><strong>{selectedApplicant.email || '—'}</strong></div>
                <div className="pr-modal-item"><span>Phone</span><strong>{selectedApplicant.phone || '—'}</strong></div>
                <div className="pr-modal-item"><span>Applied For</span><strong>{selectedApplicant.position}</strong></div>
                <div className="pr-modal-item"><span>CGPA</span><strong>{selectedApplicant.cgpa}</strong></div>
                <div className="pr-modal-item"><span>Degree</span><strong>{selectedApplicant.degree}</strong></div>
                <div className="pr-modal-item"><span>Institute</span><strong>{selectedApplicant.institute}</strong></div>
                <div className="pr-modal-item"><span>Experience</span><strong>{selectedApplicant.experience || '—'}</strong></div>
                <div className="pr-modal-item"><span>Applied On</span><strong>{selectedApplicant.appliedDate ? formatDate(selectedApplicant.appliedDate) : '—'}</strong></div>
                <div className="pr-modal-item full"><span>Research Interest</span><strong>{selectedApplicant.research}</strong></div>
                <div className="pr-modal-item full"><span>Skills</span><strong>{(selectedApplicant.skills || []).join(', ')}</strong></div>
              </div>
              <div className="pr-modal-resume">
                <div className="pr-resume-info"><i className="fa fa-file-pdf-o"></i> <span>{selectedApplicant.resume || 'No resume attached'}</span></div>
                {selectedApplicant.resume && (
                  <div className="pr-resume-btns">
                    <a className="pr-resume-btn" href={selectedApplicant.resumeUrl} target="_blank" rel="noopener noreferrer"><i className="fa fa-eye"></i> View Resume</a>
                    <a className="pr-resume-btn outline" href={selectedApplicant.resumeUrl} download target="_blank" rel="noopener noreferrer"><i className="fa fa-download"></i> Download</a>
                  </div>
                )}
              </div>
              <div className="pr-modal-actions">
                <button className="pr-decision-btn shortlist" onClick={() => setAppStatus('Shortlisted')}><i className="fa fa-star"></i> Shortlist</button>
                <button className="pr-decision-btn interview" onClick={() => setAppStatus('Interview Scheduled')}><i className="fa fa-calendar"></i> Interview</button>
                <button className="pr-decision-btn select" onClick={() => setAppStatus('Selected')}><i className="fa fa-check"></i> Select</button>
                <button className="pr-decision-btn reject" onClick={() => setAppStatus('Rejected')}><i className="fa fa-times"></i> Reject</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectRecruitment;
