import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ExternalLayout from '../externalReview/ExternalLayout';
import CustomButton from '../../components/forms/fields/CustomButton';
import { apiPublicOpening, apiPublicApply } from '../../api/publicOpenings';
import { formatDate } from '../../utils/timeParse';
import '../projects/Openings.css';
import Page from '../../components/page/Page';
import Panel, { PanelSection } from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import FormActions from '../../components/common/FormActions';

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
        <Page>
          <Panel><StatusNotice tone="loading" title="Loading the opening" /></Panel>
        </Page>
      </ExternalLayout>
    );
  }

  if (error) {
    return (
      <ExternalLayout crumbs={crumbs()}>
        <Page>
          <Panel>
            <StatusNotice
              tone="error"
              action={<Link to="/openings" className="custom-button custom-button--quiet">See all open positions</Link>}
            >
              {error}
            </StatusNotice>
          </Panel>
        </Page>
      </ExternalLayout>
    );
  }

  if (submitted) {
    return (
      <ExternalLayout crumbs={crumbs(opening.title)}>
        <Page title="Application received" description="One more step to confirm it.">
          <Panel title="Check your email">
            <div className="xr-stack">
              <p className="op-jd-text">
                We sent a confirmation link to <strong>{form.email.trim()}</strong>. Open it so
                the principal investigator knows the application is genuine.
              </p>
              <p className="op-jd-text">
                You can track this application here:{' '}
                <Link to={`/applications/${submitted}`}>/applications/{submitted.slice(0, 12)}...</Link>
              </p>
            </div>
          </Panel>
        </Page>
      </ExternalLayout>
    );
  }

  const project = opening.project || {};

  return (
    <ExternalLayout crumbs={crumbs(opening.title)}>
      <Page
        title={opening.title}
        description={<><i className="fa fa-flask" aria-hidden="true"></i> {opening.project_title}</>}
        meta={opening.type && <span className="badge badge--accent">{opening.type}</span>}
      >
        <Panel>
          <PanelSection>
            <dl className="facts">
              {opening.stipend && <div><dt>Stipend</dt><dd>{opening.stipend}</dd></div>}
              {opening.openings != null && <div><dt>Openings</dt><dd>{opening.openings}</dd></div>}
              {opening.min_cgpa && <div><dt>Min CGPA</dt><dd>{opening.min_cgpa}</dd></div>}
              {opening.deadline && <div><dt>Apply by</dt><dd>{formatDate(opening.deadline)}</dd></div>}
              {opening.pi_name && <div><dt>Principal investigator</dt><dd>{opening.pi_name}</dd></div>}
              {opening.pi_department && <div><dt>Department</dt><dd>{opening.pi_department}</dd></div>}
            </dl>
          </PanelSection>

          {opening.eligibility && (
            <PanelSection title="Eligibility">
              <p className="op-jd-text">{opening.eligibility}</p>
            </PanelSection>
          )}

          {skillList(opening.skills).length > 0 && (
            <PanelSection title="Skills">
              <div className="op-skills">
                {skillList(opening.skills).map((s, i) => <span key={i} className="op-skill">{s}</span>)}
              </div>
            </PanelSection>
          )}

          {opening.description && (
            <PanelSection title="About the role">
              <p className="op-jd-text">{opening.description}</p>
            </PanelSection>
          )}

          <PanelSection title="The project">
            <div className="xr-stack">
              <p className="op-jd-text">
                <strong>{project.title}</strong>
                {project.category ? ` (${project.category})` : ''}
                {project.funding_agency ? `, funded by ${project.funding_agency}` : ''}
              </p>
              {project.focus_area && <p className="op-jd-text">Focus area: {project.focus_area}</p>}
              {project.description && <p className="op-jd-text">{project.description}</p>}

              {opening.advertisement_url && (
                <p className="op-jd-text">
                  <a href={opening.advertisement_url} target="_blank" rel="noopener noreferrer">
                    <i className="fa fa-file-pdf-o" aria-hidden="true"></i> Read the full advertisement
                  </a>
                </p>
              )}
            </div>
          </PanelSection>
        </Panel>

        <Panel title="Apply for this position">
          <PanelSection title="Contact details">
            <div className="op-form-grid">
              <div className="op-field"><label htmlFor="public-opening-detail-full-name">Full name *</label><input id="public-opening-detail-full-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Your full name" /></div>
              <div className="op-field"><label htmlFor="public-opening-detail-email">Email *</label><input id="public-opening-detail-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
              <div className="op-field"><label htmlFor="public-opening-detail-phone">Phone *</label><input id="public-opening-detail-phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="+91-" /></div>
            </div>
          </PanelSection>

          <PanelSection title="Academic details">
            <div className="op-form-grid">
              <div className="op-field"><label htmlFor="public-opening-detail-degree">Degree *</label><input id="public-opening-detail-degree" value={form.degree} onChange={e => setForm({ ...form, degree: e.target.value })} placeholder="e.g. M.Tech CSE" /></div>
              <div className="op-field"><label htmlFor="public-opening-detail-institute">Institute *</label><input id="public-opening-detail-institute" value={form.institute} onChange={e => setForm({ ...form, institute: e.target.value })} placeholder="Where you studied" /></div>
              <div className="op-field"><label htmlFor="public-opening-detail-cgpa">CGPA *</label><input id="public-opening-detail-cgpa" value={form.cgpa} onChange={e => setForm({ ...form, cgpa: e.target.value })} placeholder="e.g. 8.5" /></div>
            </div>
          </PanelSection>

          <PanelSection title="Profile">
            <div className="op-field full"><label htmlFor="public-opening-detail-skills-comma-separated">Skills (comma separated)</label><input id="public-opening-detail-skills-comma-separated" value={form.skills} onChange={e => setForm({ ...form, skills: e.target.value })} placeholder="e.g. Python, ML, IoT" /></div>
            <div className="op-field full"><label htmlFor="public-opening-detail-research-interest">Research interest</label><input id="public-opening-detail-research-interest" value={form.research} onChange={e => setForm({ ...form, research: e.target.value })} placeholder="e.g. Edge AI" /></div>
            <div className="op-field full">
              <label>Resume *</label>
              <button type="button" className="op-upload" onClick={() => resumeRef.current && resumeRef.current.click()}>
                <i className="fa fa-upload" aria-hidden="true"></i> {form.resume || 'Select resume from system'}
              </button>
              <input type="file" ref={resumeRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={handleResume} />
            </div>
            <div className="op-field full"><label htmlFor="public-opening-detail-cover-note">Cover note</label><textarea id="public-opening-detail-cover-note" rows="3" value={form.coverNote} onChange={e => setForm({ ...form, coverNote: e.target.value })} placeholder="A short statement of purpose (optional)" /></div>

            <div className="op-hp" aria-hidden="true">
              <label htmlFor="public-opening-detail-website">Website</label>
              <input id="public-opening-detail-website" tabIndex="-1" autoComplete="off" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
            </div>

            {formError && <p className="op-form-error">{formError}</p>}

            <FormActions>
              <CustomButton
                text={submitting ? 'Submitting...' : 'Submit application'}
                onClick={submitting ? undefined : submit}
              />
            </FormActions>
          </PanelSection>
        </Panel>
      </Page>
    </ExternalLayout>
  );
};

export default PublicOpeningDetail;
