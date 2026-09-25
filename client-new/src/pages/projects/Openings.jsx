import React, { useState, useRef, useEffect } from 'react';
import { formatDate } from '../../utils/timeParse';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { useView } from '../../api/views';
import { apiApply } from '../../api/openings';
import CustomModal from '../../components/forms/modal/CustomModal';
import Tabs from '../../components/tabs/Tabs';
import CustomButton from '../../components/forms/fields/CustomButton';
import { toast } from 'react-toastify';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import './Openings.css';

const emptyApply = { name: '', email: '', phone: '', degree: '', institute: '', cgpa: '', skills: '', research: '', resume: '', resumeFile: null, coverNote: '' };

/**
 * The openings board (GET /views/openings, server: App\Pages\OpeningsPage):
 * the page is described once and kept, and the positions and the scholar's
 * applications come from GET /openings/board with every value phrased.
 */
const Openings = () => {
  const { view } = useView('openings');
  const [tab, setTab] = useState('All');
  const [applyFor, setApplyFor] = useState(null);
  const [viewJob, setViewJob] = useState(null);
  const [form, setForm] = useState(emptyApply);
  const [board, setBoard] = useState(null);
  const resumeRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // The form as the modal opened, prefilled, so closing asks only after typing.
  const applyStart = useRef(emptyApply);

  // Read again after applying without the loading notice, as the board did.
  const loadData = async (quietly = false) => {
    if (!quietly) setLoading(true);
    const res = await customFetch(`${baseURL}/openings/board`, 'GET', {}, false);
    if (res.success) setBoard(res.response);
    setLoadFailed(!res.success);
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  if (!view) return null;
  const ready = !loading && !loadFailed;
  const positions = board?.positions || [];
  const myApps = board?.applications || [];
  const openPositions = positions.filter((p) => !p.closed);
  const posById = (positionId) => positions.find((p) => p.id === positionId);
  const counts = { All: openPositions.length, Applied: myApps.length };

  // Prefill the apply form from the scholar's profile; all fields stay editable.
  const openApply = (pos) => {
    applyStart.current = { ...emptyApply, ...board.apply_values };
    setForm(applyStart.current);
    setApplyFor(pos);
  };
  const closeApply = () => {
    const typed = JSON.stringify(form) !== JSON.stringify(applyStart.current);
    if (typed && !window.confirm('Close this application? The details you entered will be lost.')) return;
    setApplyFor(null);
  };
  const handleResume = (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) setForm((prev) => ({ ...prev, resume: f.name, resumeFile: f }));
    e.target.value = '';
  };
  const submitApply = async () => {
    const missing = view.apply_checks.find((check) => check.keys.some((key) => (typeof form[key] === 'string' ? !form[key].trim() : !form[key])));
    if (missing) { toast.error(missing.message); return; }
    // A second click while the first was on its way applied twice.
    if (submitting) return;
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
    setSubmitting(true);
    const res = await apiApply(applyFor.id, fd);
    setSubmitting(false);
    if (res.success) {
      setApplyFor(null);
      toast.success('Application submitted.');
      setTab('Applied');
      loadData(true);
    }
  };

  const renderPosCard = (pos) => (
    <Panel key={pos.id} className="op-posting">
      <div className="op-card-top">
        <div className="op-card-head">
          <span className="badge badge--accent">{pos.type}</span>
          <h3 className="op-title">{pos.title}</h3>
          <p className="op-project"><i className="fa fa-flask" aria-hidden="true"></i> {pos.project}</p>
        </div>
        {pos.deadline && (
          <span className="badge badge--warning">
            <i className="fa fa-calendar" aria-hidden="true"></i> Apply by {formatDate(pos.deadline)}
          </span>
        )}
      </div>
      {pos.description && <p className="op-desc">{pos.description}</p>}
      <div className="op-meta">
        {pos.stipend && <span><i className="fa fa-inr" aria-hidden="true"></i> {pos.stipend}</span>}
        {pos.eligibility && <span><i className="fa fa-graduation-cap" aria-hidden="true"></i> {pos.eligibility}</span>}
        {pos.cgpa && <span><i className="fa fa-star-o" aria-hidden="true"></i> Min CGPA {pos.cgpa}</span>}
        {pos.openings != null && <span><i className="fa fa-users" aria-hidden="true"></i> {pos.openings} opening(s)</span>}
      </div>
      {pos.skills.length > 0 && (
        <div className="op-skills">{pos.skills.map((s, i) => <span key={i} className="op-skill">{s}</span>)}</div>
      )}
      <div className="op-card-actions">
        <CustomButton text="View details" variant="quiet" onClick={() => setViewJob(pos)} />
        {pos.applied ? (
          <span className="badge badge--success"><i className="fa fa-check" aria-hidden="true"></i> Applied</span>
        ) : (
          <CustomButton text="Apply now" variant="secondary" onClick={() => openApply(pos)} />
        )}
      </div>
    </Panel>
  );

  const required = <span className="req" aria-hidden="true">*</span>;

  return (
    <Page
      title={view.title}
      description={view.description}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={view.tabs.map((each) => ({ value: each.value, label: each.label.replace('{n}', counts[each.value]) }))}
        />
      }
    >
      {loading && <StatusNotice tone="loading" title={view.states.loading} />}
      {!loading && loadFailed && (
        <LoadError message={view.states.failed} onRetry={() => loadData()} />
      )}

      {ready && tab === 'All' && (openPositions.length ? (
        <div className="op-grid reveal">{openPositions.map((p) => renderPosCard(p))}</div>
      ) : <StatusNotice tone="empty" title={view.states.All} />)}

      {ready && tab === 'Applied' && (myApps.length ? (
        <div className="op-grid reveal">
          {myApps.map((a) => (
            <Panel key={a.id} className="op-posting">
              <div className="op-card-top">
                <div className="op-card-head">
                  <span className="badge badge--accent">{a.type}</span>
                  <h3 className="op-title">{a.title}</h3>
                  <p className="op-project"><i className="fa fa-flask" aria-hidden="true"></i> {a.project}</p>
                </div>
                <span className={`badge badge--${a.badge.tone}`}>{a.badge.text}</span>
              </div>
              <div className="op-meta">
                <span><i className="fa fa-calendar" aria-hidden="true"></i> Applied on {formatDate(a.applied_date)}</span>
                {a.resume && <span><i className="fa fa-file-pdf-o" aria-hidden="true"></i> {a.resume}</span>}
              </div>
              {a.position_id && (
                <div className="op-card-actions">
                  <CustomButton text="View details" variant="quiet" onClick={() => setViewJob(posById(a.position_id))} />
                </div>
              )}
            </Panel>
          ))}
        </div>
      ) : <StatusNotice tone="empty" title={view.states.Applied} />)}

      {/* Job Description Modal */}
      <CustomModal isOpen={!!viewJob} onClose={() => setViewJob(null)} maxWidth="560px" minHeight="auto">
        {viewJob && (
          <>
            <span className="badge badge--accent">{viewJob.type}</span>
            <h2 className="op-jd-title">{viewJob.title}</h2>
            <p className="op-jd-project"><i className="fa fa-flask" aria-hidden="true"></i> {viewJob.project}</p>
            <dl className="facts op-jd-dl">
              {viewJob.stipend && <div><dt>Stipend</dt><dd>{viewJob.stipend}</dd></div>}
              {viewJob.openings != null && <div><dt>Openings</dt><dd>{viewJob.openings}</dd></div>}
              {viewJob.cgpa && <div><dt>Min CGPA</dt><dd>{viewJob.cgpa}</dd></div>}
              {viewJob.deadline && <div><dt>Apply by</dt><dd>{formatDate(viewJob.deadline)}</dd></div>}
            </dl>
            {viewJob.eligibility && (<><h3 className="op-modal-section">Eligibility</h3><p className="op-jd-text">{viewJob.eligibility}</p></>)}
            {viewJob.description
              ? (<><h3 className="op-modal-section">Job description</h3><p className="op-jd-text">{viewJob.description}</p></>)
              : (<><h3 className="op-modal-section">Job description</h3><p className="op-jd-text op-jd-muted">No description provided for this opening.</p></>)}
            {viewJob.skills.length > 0 && (<><h3 className="op-modal-section">Skills</h3><div className="op-skills">{viewJob.skills.map((s, i) => <span key={i} className="op-skill">{s}</span>)}</div></>)}
            <div className="modal-actions">
              <CustomButton text="Close" variant="quiet" onClick={() => setViewJob(null)} />
              {viewJob.closed ? (
                <CustomButton text="Applications closed" disabled />
              ) : viewJob.applied ? (
                <CustomButton text="Applied" variant="success" disabled />
              ) : (
                <CustomButton text="Apply now" onClick={() => { const p = viewJob; setViewJob(null); openApply(p); }} />
              )}
            </div>
          </>
        )}
      </CustomModal>

      {/* Apply Modal */}
      <CustomModal
        isOpen={!!applyFor}
        onClose={closeApply}
        title={applyFor && `Apply: ${applyFor.title}`}
        maxWidth="560px"
        minHeight="auto"
      >
        {applyFor && (
          <>
            <p className="op-modal-sub">{applyFor.type} &middot; {applyFor.project}</p>

            <h3 className="op-modal-section">Contact details</h3>
            <div className="op-form-grid">
              <div className="op-field"><label htmlFor="openings-full-name">Full name {required}</label><input id="openings-full-name" aria-required="true" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Your full name" /></div>
              <div className="op-field"><label htmlFor="openings-email">Email {required}</label><input id="openings-email" type="email" aria-required="true" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" /></div>
              <div className="op-field"><label htmlFor="openings-phone">Phone {required}</label><input id="openings-phone" aria-required="true" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91-…" /></div>
            </div>

            <h3 className="op-modal-section">Academic details</h3>
            <div className="op-form-grid">
              <div className="op-field"><label htmlFor="openings-degree">Degree {required}</label><input id="openings-degree" aria-required="true" value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} placeholder="e.g. M.Tech CSE" /></div>
              <div className="op-field"><label htmlFor="openings-institute">Institute {required}</label><input id="openings-institute" aria-required="true" value={form.institute} onChange={(e) => setForm({ ...form, institute: e.target.value })} placeholder="e.g. TIET" /></div>
              <div className="op-field"><label htmlFor="openings-cgpa">CGPA {required}</label><input id="openings-cgpa" aria-required="true" value={form.cgpa} onChange={(e) => setForm({ ...form, cgpa: e.target.value })} placeholder="e.g. 8.5" /></div>
            </div>

            <h3 className="op-modal-section">Profile</h3>
            <div className="op-field full"><label htmlFor="openings-skills-comma-separated">Skills (comma separated)</label><input id="openings-skills-comma-separated" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="e.g. Python, ML, IoT" /></div>
            <div className="op-field full"><label htmlFor="openings-research-interest">Research interest</label><input id="openings-research-interest" value={form.research} onChange={(e) => setForm({ ...form, research: e.target.value })} placeholder="e.g. Edge AI" /></div>
            <div className="op-field full">
              <label htmlFor="openings-resume">Resume {required}</label>
              <button type="button" id="openings-resume" className="op-upload" onClick={() => resumeRef.current && resumeRef.current.click()}>
                <i className="fa fa-upload" aria-hidden="true"></i> {form.resume || 'Select resume from system'}
              </button>
              <input type="file" ref={resumeRef} style={{ display: 'none' }} accept=".pdf,.doc,.docx" onChange={handleResume} />
            </div>
            <div className="op-field full"><label htmlFor="openings-cover-note">Cover note</label><textarea id="openings-cover-note" rows="3" value={form.coverNote} onChange={(e) => setForm({ ...form, coverNote: e.target.value })} placeholder="A short statement of purpose (optional)…" /></div>

            <div className="modal-actions">
              <CustomButton text="Cancel" variant="quiet" onClick={closeApply} />
              <CustomButton text="Submit application" onClick={submitApply} busy={submitting} />
            </div>
          </>
        )}
      </CustomModal>
    </Page>
  );
};

export default Openings;
