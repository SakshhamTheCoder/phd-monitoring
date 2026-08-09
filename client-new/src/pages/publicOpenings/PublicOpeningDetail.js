import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import CustomButton from '../../components/forms/fields/CustomButton';
import { apiPublicOpening, apiPublicApply } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
import '../projects/Openings.css';

const emptyForm = {
  name: '', email: '', phone: '', degree: '', institute: '', cgpa: '',
  skills: '', research: '', coverNote: '', resume: '', resumeFile: null, website: '',
};

const skillList = (skills) =>
  (Array.isArray(skills) ? skills : String(skills || '').split(','))
    .map((s) => (typeof s === 'string' ? s.trim() : s))
    .filter(Boolean);

const crumbs = (title) => [
  { label: 'Openings', to: '/openings' },
  { label: title || 'Opening' },
];

const PublicOpeningDetail = () => {
  const { id } = useParams();
  const resumeRef = useRef(null);

  const [opening, setOpening] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    let active = true;
    apiPublicOpening(id).then(({ ok, body }) => {
      if (!active) return;
      if (ok) setOpening(body);
      else setError(body.message || 'This opening is no longer available.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [id]);

  const handleResume = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setForm({ ...form, resume: file.name, resumeFile: file });
  };

  const submit = async () => {
    setFormError(null);
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setFormError('Please fill in your name, email and phone number.');
      return;
    }
    if (!form.degree.trim() || !form.institute.trim() || !form.cgpa.trim()) {
      setFormError('Please fill in your academic details.');
      return;
    }
    if (!form.resumeFile) {
      setFormError('Please attach your resume.');
      return;
    }

    setSubmitting(true);
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
    fd.append('website', form.website);
    fd.append('resume', form.resumeFile);

    const { ok, body } = await apiPublicApply(id, fd);
    setSubmitting(false);
    if (ok) {
      setSubmitted(body.token);
      return;
    }
    if (body.errors) {
      setFormError(Object.values(body.errors).flat().join(' '));
      return;
    }
    setFormError(body.message || 'Your application could not be submitted. Please try again.');
  };

  if (loading) {
    return (
      <ExternalLayout crumbs={crumbs()}>
        <p className="empty-state">Loading...</p>
      </ExternalLayout>
    );
  }

  if (error) {
    return (
      <ExternalLayout crumbs={crumbs()}>
        <p className="empty-state">{error}</p>
        <p className="empty-state"><Link to="/openings">See all open positions</Link></p>
      </ExternalLayout>
    );
  }

  if (submitted) {
    return (
      <ExternalLayout crumbs={crumbs(opening.title)}>
        <div className="op-container">
          <div className="page-header">
            <div>
              <h1 className="page-title">Application received</h1>
              <p className="page-subtitle">One more step to confirm it.</p>
            </div>
          </div>
          <div className="card">
            <h3 className="section-heading">Check your email</h3>
            <p className="op-jd-text">
              We sent a confirmation link to <strong>{form.email.trim()}</strong>. Open it so
              the principal investigator knows the application is genuine.
            </p>
            <p className="op-jd-text" style={{ marginTop: '1rem' }}>
              You can track this application here:{' '}
              <Link to={`/applications/${submitted}`}>/applications/{submitted.slice(0, 12)}...</Link>
            </p>
          </div>
        </div>
      </ExternalLayout>
    );
  }

  const project = opening.project || {};

  return (
    <ExternalLayout crumbs={crumbs(opening.title)}>
      <div className="op-container">
        <div className="page-header">
          <div>
            <span className="op-type">{opening.type}</span>
            <h1 className="page-title">{opening.title}</h1>
            <p className="page-subtitle"><i className="fa fa-flask"></i> {opening.project_title}</p>
          </div>
        </div>

        <div className="card">

          <div className="op-jd-facts">
            {opening.stipend && <div className="op-jd-fact"><span>Stipend</span><strong>{opening.stipend}</strong></div>}
            {opening.openings != null && <div className="op-jd-fact"><span>Openings</span><strong>{opening.openings}</strong></div>}
            {opening.min_cgpa && <div className="op-jd-fact"><span>Min CGPA</span><strong>{opening.min_cgpa}</strong></div>}
            {opening.deadline && <div className="op-jd-fact"><span>Apply by</span><strong>{formatDate(opening.deadline)}</strong></div>}
            {opening.pi_name && <div className="op-jd-fact"><span>Principal investigator</span><strong>{opening.pi_name}</strong></div>}
            {opening.pi_department && <div className="op-jd-fact"><span>Department</span><strong>{opening.pi_department}</strong></div>}
          </div>

          {opening.eligibility && (
            <>
              <div className="op-modal-section">Eligibility</div>
              <p className="op-jd-text">{opening.eligibility}</p>
            </>
          )}

          {skillList(opening.skills).length > 0 && (
            <>
              <div className="op-modal-section">Skills</div>
              <div className="op-skills">
                {skillList(opening.skills).map((s, i) => <span key={i} className="op-skill">{s}</span>)}
              </div>
            </>
          )}

          {opening.description && (
            <>
              <div className="op-modal-section">About the role</div>
              <p className="op-jd-text">{opening.description}</p>
            </>
          )}

          <div className="op-modal-section">The project</div>
          <p className="op-jd-text">
            <strong>{project.title}</strong>
            {project.category ? ` (${project.category})` : ''}
            {project.funding_agency ? `, funded by ${project.funding_agency}` : ''}
          </p>
          {project.focus_area && <p className="op-jd-text">Focus area: {project.focus_area}</p>}
          {project.description && <p className="op-jd-text">{project.description}</p>}

          {opening.advertisement_url && (
            <p className="op-jd-text" style={{ marginTop: '1rem' }}>
              <a href={opening.advertisement_url} target="_blank" rel="noopener noreferrer">
                <i className="fa fa-file-pdf-o"></i> Read the full advertisement
              </a>
            </p>
          )}
        </div>

        <div className="card">
          <h3 className="section-heading">Apply for this position</h3>

          <div className="op-modal-section">Contact details</div>
          <div className="op-form-grid">
            <div className="op-field"><label>Full Name *</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" /></div>
            <div className="op-field"><label>Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
            <div className="op-field"><label>Phone *</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91-" /></div>
          </div>

          <div className="op-modal-section">Academic details</div>
          <div className="op-form-grid">
            <div className="op-field"><label>Degree *</label><input value={form.degree} onChange={e => setForm({ ...form, degree: e.target.value })} placeholder="e.g. M.Tech CSE" /></div>
            <div className="op-field"><label>Institute *</label><input value={form.institute} onChange={e => setForm({ ...form, institute: e.target.value })} placeholder="Where you studied" /></div>
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
          <div className="op-field full"><label>Cover Note</label><textarea rows="3" value={form.coverNote} onChange={e => setForm({ ...form, coverNote: e.target.value })} placeholder="A short statement of purpose (optional)" /></div>

          <div className="op-hp" aria-hidden="true">
            <label htmlFor="website">Website</label>
            <input id="website" tabIndex="-1" autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          </div>

          {formError && <p className="op-form-error">{formError}</p>}

          <div className="modal-actions">
            <CustomButton
              text={submitting ? 'Submitting...' : 'Submit application'}
              onClick={submitting ? undefined : submit}
            />
          </div>
        </div>
      </div>
    </ExternalLayout>
  );
};

export default PublicOpeningDetail;
