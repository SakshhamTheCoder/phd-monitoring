import React, { useState, useRef, useEffect } from 'react';
import Layout from '../../components/dashboard/layout';
import { formatDate } from '../../data/projectsData';
import { apiOpenings, apiApply, apiMyApplications, apiApplicantProfile } from '../../api/openings';
import { toast } from 'react-toastify';
import './Openings.css';

const emptyApply = { name: '', email: '', phone: '', degree: '', institute: '', cgpa: '', skills: '', research: '', resume: '', resumeFile: null, coverNote: '' };

const statusColors = {
  Applied: { bg: '#e0e7ff', color: '#3730a3' },
  Shortlisted: { bg: '#fef3c7', color: '#92400e' },
  'Interview Scheduled': { bg: '#dbeafe', color: '#1e40af' },
  Selected: { bg: '#dcfce7', color: '#15803d' },
  Rejected: { bg: '#fee2e2', color: '#b91c1c' },
};

const Openings = () => {
  const today = new Date().toISOString().split('T')[0];
  const [tab, setTab] = useState('All');
  const [applyFor, setApplyFor] = useState(null);
  const [viewJob, setViewJob] = useState(null);
  const [form, setForm] = useState(emptyApply);
  const [positions, setPositions] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [profile, setProfile] = useState({});
  const resumeRef = useRef(null);

  const loadData = async () => {
    const [pos, apps, prof] = await Promise.all([apiOpenings(), apiMyApplications(), apiApplicantProfile()]);
    setPositions(pos);
    setMyApps(apps);
    setProfile(prof || {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  const posByKey = (key) => positions.find(p => p.posKey === key);
  const appliedKeys = new Set(myApps.map(a => String(a.posKey)));
  const openPositions = positions.filter(p => !p.deadline || p.deadline >= today);
  const closedPositions = positions.filter(p => p.deadline && p.deadline < today);

  // Prefill the apply form from the logged-in student's profile; all fields stay editable.
  const openApply = (pos) => {
    setForm({
      ...emptyApply,
      name: profile.name || '',
      email: profile.email || '',
      phone: profile.phone || '',
      degree: profile.degree || '',
      institute: profile.institute || '',
      cgpa: profile.cgpa || '',
      research: profile.research || '',
    });
    setApplyFor(pos);
  };
  const handleResume = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setForm(prev => ({ ...prev, resume: f.name, resumeFile: f }));
    e.target.value = '';
  };
  const submitApply = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) { toast.error('Please fill in your contact details.'); return; }
    if (!form.degree.trim() || !form.institute.trim() || !form.cgpa.trim()) { toast.error('Please fill in your academic details.'); return; }
    if (!form.resumeFile) { toast.error('Please attach your resume.'); return; }
    const fd = new FormData();
    fd.append('name', form.name.trim());
    fd.append('email', form.email.trim());
    fd.append('phone', form.phone.trim());
    fd.append('degree', form.degree.trim());
    fd.append('institute', form.institute.trim());
    fd.append('cgpa', form.cgpa.trim());
    fd.append('research', form.research.trim());
    fd.append('cover_note', form.coverNote.trim());
    fd.append('skills', form.skills.trim());
    fd.append('resume', form.resumeFile);
    const res = await apiApply(applyFor.id, fd);
    if (res.success) {
      setMyApps(await apiMyApplications());
      setApplyFor(null);
      toast.success('Application submitted successfully!');
      setTab('Applied');
    }
  };

  const skillList = (skills) => (Array.isArray(skills) ? skills : String(skills || '').split(',')).map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean);

  const renderPosCard = (pos, closed) => (
    <div key={pos.posKey} className="op-card">
      <div className="op-card-top">
        <div className="op-card-head">
          <span className="op-type">{pos.type}</span>
          <h3 className="op-title">{pos.title}</h3>
          <p className="op-project"><i className="fa fa-flask"></i> {pos.projectTitle}</p>
        </div>
        {pos.deadline && (
          <span className={`op-deadline ${closed ? 'closed' : ''}`}>
            <i className="fa fa-calendar"></i> {closed ? 'Closed on' : 'Apply by'} {formatDate(pos.deadline)}
          </span>
        )}
      </div>
      {pos.description && <p className="op-desc">{pos.description}</p>}
      <div className="op-meta">
        {pos.stipend && <span><i className="fa fa-inr"></i> {pos.stipend}</span>}
        {pos.eligibility && <span><i className="fa fa-graduation-cap"></i> {pos.eligibility}</span>}
        {pos.cgpa && <span><i className="fa fa-star-o"></i> Min CGPA {pos.cgpa}</span>}
        {pos.openings != null && <span><i className="fa fa-users"></i> {pos.openings} opening(s)</span>}
      </div>
      {skillList(pos.skills).length > 0 && (
        <div className="op-skills">{skillList(pos.skills).map((s, i) => <span key={i} className="op-skill">{s}</span>)}</div>
      )}
      <div className="op-card-actions">
        <button className="op-details-btn" onClick={() => setViewJob(pos)}><i className="fa fa-file-text-o"></i> View Details</button>
        {closed ? (
          <button className="op-apply-btn" disabled>Applications Closed</button>
        ) : appliedKeys.has(String(pos.posKey)) ? (
          <button className="op-apply-btn applied" disabled><i className="fa fa-check"></i> Applied</button>
        ) : (
          <button className="op-apply-btn" onClick={() => openApply(pos)}><i className="fa fa-paper-plane"></i> Apply Now</button>
        )}
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="op-container">
        <div className="op-header">
          <h1 className="op-page-title">Openings</h1>
          <p className="op-subtitle">Browse research positions and internships, and apply directly through the portal.</p>
        </div>

        <div className="op-tabs">
          <button className={`op-tab ${tab === 'All' ? 'active' : ''}`} onClick={() => setTab('All')}>All ({openPositions.length})</button>
          <button className={`op-tab ${tab === 'Applied' ? 'active' : ''}`} onClick={() => setTab('Applied')}>Applied ({myApps.length})</button>
          <button className={`op-tab ${tab === 'Closed' ? 'active' : ''}`} onClick={() => setTab('Closed')}>Closed ({closedPositions.length})</button>
        </div>

        {tab === 'All' && (openPositions.length ? (
          <div className="op-grid">{openPositions.map(p => renderPosCard(p, false))}</div>
        ) : <div className="op-empty">No open positions right now. Check back soon.</div>)}

        {tab === 'Closed' && (closedPositions.length ? (
          <div className="op-grid">{closedPositions.map(p => renderPosCard(p, true))}</div>
        ) : <div className="op-empty">No closed positions.</div>)}

        {tab === 'Applied' && (myApps.length ? (
          <div className="op-grid">
            {myApps.map(a => (
              <div key={a.id} className="op-card">
                <div className="op-card-top">
                  <div className="op-card-head">
                    <span className="op-type">{a.position}</span>
                    <h3 className="op-title">{a.positionTitle}</h3>
                    <p className="op-project"><i className="fa fa-flask"></i> {a.projectTitle}</p>
                  </div>
                  <span className="op-status" style={{ background: statusColors[a.status]?.bg, color: statusColors[a.status]?.color }}>{a.status}</span>
                </div>
                <div className="op-meta">
                  <span><i className="fa fa-calendar"></i> Applied on {formatDate(a.appliedDate)}</span>
                  {a.resume && <span><i className="fa fa-file-pdf-o"></i> {a.resume}</span>}
                </div>
                {posByKey(a.posKey) && (
                  <div className="op-card-actions">
                    <button className="op-details-btn" onClick={() => setViewJob(posByKey(a.posKey))}><i className="fa fa-file-text-o"></i> View Details</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : <div className="op-empty">You haven't applied to any openings yet.</div>)}

        {/* Job Description Modal */}
        {viewJob && (
          <div className="op-modal-overlay" onClick={() => setViewJob(null)}>
            <div className="op-modal" onClick={e => e.stopPropagation()}>
              <button className="op-modal-close" onClick={() => setViewJob(null)}><i className="fa fa-times"></i></button>
              <span className="op-type">{viewJob.type}</span>
              <h2 className="op-jd-title">{viewJob.title}</h2>
              <p className="op-jd-project"><i className="fa fa-flask"></i> {viewJob.projectTitle}</p>
              <div className="op-jd-facts">
                {viewJob.stipend && <div className="op-jd-fact"><span>Stipend</span><strong>{viewJob.stipend}</strong></div>}
                {viewJob.openings != null && <div className="op-jd-fact"><span>Openings</span><strong>{viewJob.openings}</strong></div>}
                {viewJob.cgpa && <div className="op-jd-fact"><span>Min CGPA</span><strong>{viewJob.cgpa}</strong></div>}
                {viewJob.deadline && <div className="op-jd-fact"><span>Apply By</span><strong>{formatDate(viewJob.deadline)}</strong></div>}
              </div>
              {viewJob.eligibility && (<><div className="op-modal-section">Eligibility</div><p className="op-jd-text">{viewJob.eligibility}</p></>)}
              {viewJob.description
                ? (<><div className="op-modal-section">Job Description</div><p className="op-jd-text">{viewJob.description}</p></>)
                : (<><div className="op-modal-section">Job Description</div><p className="op-jd-text op-jd-muted">No description provided for this opening.</p></>)}
              {skillList(viewJob.skills).length > 0 && (<><div className="op-modal-section">Skills</div><div className="op-skills">{skillList(viewJob.skills).map((s, i) => <span key={i} className="op-skill">{s}</span>)}</div></>)}
              <div className="op-modal-actions">
                <button className="op-btn-outline" onClick={() => setViewJob(null)}>Close</button>
                {viewJob.deadline && viewJob.deadline < today ? (
                  <button className="op-btn-primary" disabled style={{ opacity: 0.6 }}>Applications Closed</button>
                ) : appliedKeys.has(String(viewJob.posKey)) ? (
                  <button className="op-btn-primary" disabled style={{ background: '#dcfce7', color: '#15803d' }}><i className="fa fa-check"></i> Applied</button>
                ) : (
                  <button className="op-btn-primary" onClick={() => { const p = viewJob; setViewJob(null); openApply(p); }}><i className="fa fa-paper-plane"></i> Apply Now</button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Apply Modal */}
        {applyFor && (
          <div className="op-modal-overlay" onClick={() => setApplyFor(null)}>
            <div className="op-modal" onClick={e => e.stopPropagation()}>
              <button className="op-modal-close" onClick={() => setApplyFor(null)}><i className="fa fa-times"></i></button>
              <h2 className="op-modal-title">Apply — {applyFor.title}</h2>
              <p className="op-modal-sub">{applyFor.type} &middot; {applyFor.projectTitle}</p>

              <div className="op-modal-section">Contact Details</div>
              <div className="op-form-grid">
                <div className="op-field"><label>Full Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" /></div>
                <div className="op-field"><label>Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
                <div className="op-field"><label>Phone *</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91-…" /></div>
              </div>

              <div className="op-modal-section">Academic Details</div>
              <div className="op-form-grid">
                <div className="op-field"><label>Degree *</label><input value={form.degree} onChange={e => setForm({ ...form, degree: e.target.value })} placeholder="e.g. M.Tech CSE" /></div>
                <div className="op-field"><label>Institute *</label><input value={form.institute} onChange={e => setForm({ ...form, institute: e.target.value })} placeholder="e.g. TIET" /></div>
                <div className="op-field"><label>CGPA *</label><input value={form.cgpa} onChange={e => setForm({ ...form, cgpa: e.target.value })} placeholder="e.g. 8.5" /></div>
              </div>

              <div className="op-modal-section">Profile</div>
              <div className="op-field full"><label>Skills (comma separated)</label><input value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="e.g. Python, ML, IoT" /></div>
              <div className="op-field full"><label>Research Interest</label><input value={form.research} onChange={e => setForm({ ...form, research: e.target.value })} placeholder="e.g. Edge AI" /></div>
              <div className="op-field full">
                <label>Resume *</label>
                <button type="button" className="op-upload" onClick={() => resumeRef.current && resumeRef.current.click()}>
                  <i className="fa fa-upload"></i> {form.resume || 'Select resume from system'}
                </button>
                <input type="file" ref={resumeRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={handleResume} />
              </div>
              <div className="op-field full"><label>Cover Note</label><textarea rows="3" value={form.coverNote} onChange={e => setForm({ ...form, coverNote: e.target.value })} placeholder="A short statement of purpose (optional)…" /></div>

              <div className="op-modal-actions">
                <button className="op-btn-outline" onClick={() => setApplyFor(null)}>Cancel</button>
                <button className="op-btn-primary" onClick={submitApply}><i className="fa fa-paper-plane"></i> Submit Application</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Openings;
