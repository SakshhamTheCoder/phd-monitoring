import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  categoryOptions,
  roleOptions,
  milestoneStatusOptions,
  formatDuration,
  yearTotal,
  grandTotal,
  emptyBudget,
} from '../../data/projectsData';
import { formatDate, EMPTY_VALUE, toDateObject, toDateValue } from '../../utils/timeParse';
import { apiCreateProject, apiGetProject, apiUpdateProjectFromForm, apiUpdateProject, apiCurrentFaculty, apiProjectMeta, apiUploadGanttChart } from '../../api/projects';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel, { PanelSection } from '../../components/panel/Panel';
import CustomButton from '../../components/forms/fields/CustomButton';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import { toastUndo, insertAt } from '../../utils/undoToast';
import ProjectBudgetStep from './ProjectBudgetStep';
import './CreateProject.css';

const STEPS = ['Basic info', 'Team', 'Budget', 'Objectives', 'Milestones', 'Review'];

const emptyForm = {
  title: '', category: '', role: 'PI', focusArea: '', grantType: '',
  fundingAgency: '', description: '',
  startDate: '', durationYears: 1, durationMonths: 0, endDate: '',
  sdgs: [],
  coPIs: [],
  sanctionAmount: '', tietShare: '', sanctionLetterLink: '',
  sanctionLetterFile: null, sanctionLetterFileName: '',
  ganttFile: null, ganttFileName: '',
  budget: emptyBudget(),
  objectives: [''],
  milestones: [{ name: '', deliverable: '', dueDate: '', status: 'Not Started' }],
};

// Map an existing project record into the wizard's form shape for editing
const buildFormFromProject = (p) => ({
  title: p.title || '',
  category: p.category || '',
  role: p.role || 'PI',
  focusArea: p.focusArea || '',
  grantType: p.grantType || '',
  fundingAgency: p.fundingAgency || '',
  description: p.description || '',
  startDate: p.startDate || '',
  durationYears: p.durationYears ?? 1,
  durationMonths: p.durationMonths || 0,
  endDate: p.endDate || '',
  sdgs: p.sdgs || [],
  coPIs: p.coPIs ? p.coPIs.map(c => ({ ...c })) : [],
  sanctionAmount: p.amount != null ? String(p.amount) : '',
  tietShare: p.tietShare != null ? String(p.tietShare) : '',
  // Only an external URL belongs in the link box; a stored file is a path, not a link.
  sanctionLetterLink: /^https?:\/\//i.test(p.sanctionLetterLink || '') ? p.sanctionLetterLink : '',
  sanctionLetterFile: null,
  sanctionLetterFileName: '',
  ganttFile: null,
  ganttFileName: p.ganttChartName || '',
  budget: p.budget && Object.keys(p.budget).length ? p.budget : emptyBudget(),
  objectives: (p.objectives && p.objectives.length ? p.objectives : ['']).map((o) => (typeof o === 'string' ? o : [o.title, o.description].filter(Boolean).join(': '))),
  milestones: p.milestones?.length ? p.milestones.map(m => ({ ...m })) : [{ name: '', deliverable: '', dueDate: '', status: 'Not Started' }],
});

const CreateProject = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editProject = location.state?.editProject || null;
  const isEditMode = !!editProject;
  const [currentStep, setCurrentStep] = useState(0);
  // Edit opens from the projects list too, whose rows carry no milestones, so
  // the wizard loads the whole project before it shows the form.
  const [stored, setStored] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [initialForm, setInitialForm] = useState(() => (isEditMode ? null : { ...emptyForm }));
  const [form, setForm] = useState(initialForm);
  const [showExtForm, setShowExtForm] = useState(false);
  const [extCopi, setExtCopi] = useState({ name: '', designation: '', institute: '', email: '', mobile: '', website: '' });
  const [pi, setPi] = useState(editProject?.pi || null);
  // The row just added, as 'copi-2' or 'milestone-0', so it is marked where it landed.
  const [lastAdded, setLastAdded] = useState(null);
  const sanctionRef = useRef(null);
  const ganttRef = useRef(null);
  const [meta, setMeta] = useState({ sdgs: [], manpowerCategories: [], budgetHeads: [], duration: { years: [0,1,2,3,4,5], maxMonths: 11 } });

  useEffect(() => {
    if (!pi) apiCurrentFaculty().then(f => f && setPi(f));
    apiProjectMeta().then(setMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [loadAttempt, setLoadAttempt] = useState(0);
  useEffect(() => {
    if (!isEditMode) return undefined;
    let cancelled = false;
    setLoadFailed(false);
    apiGetProject(editProject.id).then(({ project }) => {
      if (cancelled) return;
      if (!project) {
        setLoadFailed(true);
        return;
      }
      const built = buildFormFromProject(project);
      setStored(project);
      setInitialForm(built);
      setForm(built);
      if (project.pi) setPi(project.pi);
    });
    return () => { cancelled = true; };
  }, [isEditMode, editProject?.id, loadAttempt]);

  const updateField = (field, value) => {
    const updated = { ...form, [field]: value };
    if (field === 'startDate' || field === 'durationYears' || field === 'durationMonths') {
      const sd = field === 'startDate' ? value : form.startDate;
      const dy = field === 'durationYears' ? parseInt(value) || 0 : parseInt(form.durationYears) || 0;
      const dm = field === 'durationMonths' ? parseInt(value) || 0 : parseInt(form.durationMonths) || 0;
      if (sd) {
        // Local midnight in and a local date out. new Date('YYYY-MM-DD') is
        // UTC midnight and toISOString is UTC, so mixing them with the local
        // setters can land the end date a day off.
        const d = toDateObject(sd);
        d.setFullYear(d.getFullYear() + dy);
        d.setMonth(d.getMonth() + dm);
        updated.endDate = toDateValue(d);
      }
    }
    setForm(updated);
  };

  const addInternalCopi = (fac) => {
    if (!fac || !fac.name) return;
    if (form.coPIs.find(c => c.name === fac.name)) return;
    setLastAdded(`copi-${form.coPIs.length}`);
    setForm({
      ...form,
      coPIs: [...form.coPIs, {
        type: 'internal', faculty_code: fac.id, name: fac.name,
        department: fac.department, designation: fac.designation, email: fac.email,
      }],
    });
  };

  const addExternalCopi = () => {
    if (extCopi.name) {
      setLastAdded(`copi-${form.coPIs.length}`);
      setForm({ ...form, coPIs: [...form.coPIs, { type: 'external', ...extCopi }] });
      setExtCopi({ name: '', designation: '', institute: '', email: '', mobile: '', website: '' });
      setShowExtForm(false);
    }
  };

  // Nothing is saved until Submit, so a removal happens at once and Undo puts it back.
  const removeCopi = (idx) => {
    const removed = form.coPIs[idx];
    // Rows are keyed by index, so the mark would land on whichever row an Undo shifts there.
    setLastAdded(null);
    setForm({ ...form, coPIs: form.coPIs.filter((_, i) => i !== idx) });
    toastUndo(`${removed.name} removed.`, () => setForm(prev => ({ ...prev, coPIs: insertAt(prev.coPIs, idx, removed) })));
  };

  const removeObjective = (idx) => {
    const removed = form.objectives[idx];
    setForm(p => ({ ...p, objectives: p.objectives.filter((_, j) => j !== idx) }));
    toastUndo('Objective removed.', () => setForm(prev => ({ ...prev, objectives: insertAt(prev.objectives, idx, removed) })));
  };

  const handleSanctionFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setForm(prev => ({ ...prev, sanctionLetterFile: file, sanctionLetterFileName: file.name }));
  };

  const addMilestone = () => {
    setLastAdded(`milestone-${form.milestones.length}`);
    setForm({ ...form, milestones: [...form.milestones, { name: '', deliverable: '', dueDate: '', status: 'Not Started' }] });
  };
  const removeMilestone = (i) => {
    const removed = form.milestones[i];
    setLastAdded(null);
    setForm({ ...form, milestones: form.milestones.filter((_, idx) => idx !== i) });
    toastUndo('Milestone removed.', () => setForm(prev => ({ ...prev, milestones: insertAt(prev.milestones, i, removed) })));
  };
  const updateMilestone = (i, field, val) => {
    const ms = [...form.milestones];
    ms[i] = { ...ms[i], [field]: val };
    setForm({ ...form, milestones: ms });
  };

  const milestoneProgress = () => {
    const done = form.milestones.filter(m => m.status === 'Completed').length;
    return form.milestones.length ? Math.round((done / form.milestones.length) * 100) : 0;
  };

  const [submitting, setSubmitting] = useState(false);

  // The sanction letter rides on the update endpoint, which already knows how to
  // swap a file for a link and clean up whichever it replaced.
  const saveSanctionLetter = async (projectId) => {
    if (form.sanctionLetterFile) {
      const fd = new FormData();
      fd.append('sanction_letter', form.sanctionLetterFile);
      return apiUpdateProject(projectId, fd, true);
    }
    const link = (form.sanctionLetterLink || '').trim();
    if (/^https?:\/\//i.test(link)) {
      return apiUpdateProject(projectId, { sanction_letter_link: link, sanction_letter_name: 'Sanction Letter' });
    }
    return null;
  };

  // The server only names a missing field as "Validation failed", so say which
  // one here and open the step it is on.
  const missingField = () => {
    if (!form.title.trim()) return 'the project title';
    if (!form.category) return 'a category';
    return null;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const missing = missingField();
    if (missing) {
      setCurrentStep(0);
      toast.error(`Enter ${missing} on the Basic info step before submitting.`);
      return;
    }
    setSubmitting(true);
    const res = isEditMode
      ? await apiUpdateProjectFromForm(editProject.id, form, stored.milestones)
      : await apiCreateProject(form);
    const failedParts = [];
    if (res.success) {
      const projectId = isEditMode ? editProject.id : res.project.id;
      const ganttProjectId = res.project?.id || projectId;
      const [sanction, gantt] = await Promise.all([
        saveSanctionLetter(projectId),
        form.ganttFile && ganttProjectId ? apiUploadGanttChart(ganttProjectId, form.ganttFile) : null,
      ]);
      if (res.failedMilestones) failedParts.push(res.failedMilestones === 1 ? '1 milestone' : `${res.failedMilestones} milestones`);
      if (sanction && !sanction.success) failedParts.push('the sanction letter');
      if (gantt && !gantt.success) failedParts.push('the Gantt chart');
    }
    setSubmitting(false);
    if (res.success) {
      const saved = isEditMode ? 'Project updated' : 'Project created';
      // The project itself saved, so carry on to the list and say what did not.
      if (failedParts.length) toast.warning(`${saved}, but ${failedParts.join(' and ')} could not be saved. Add them from the project page.`);
      else toast.success(`${saved}.`);
      navigate('/projects');
    }
  };

  // Derived from the chosen duration (1-5 years) so the wizard's year columns
  // match the Grand Total's real year list. Shrinking the duration only
  // hides the extra columns here; it never deletes the budget data stored
  // under those years.
  const leave = () => {
    const changed = JSON.stringify(form) !== JSON.stringify(initialForm);
    const lost = isEditMode ? 'Your unsaved changes to this project will be lost.' : 'The project details you have entered will be lost.';
    if (changed && !window.confirm(`Leave this page? ${lost}`)) return;
    navigate('/projects');
  };

  const backLink = (
    <button type="button" className="page-back-link cp-back" onClick={leave}>
      <i className="fa fa-arrow-left" aria-hidden="true"></i> Back to projects
    </button>
  );

  if (!form) {
    return (
      <>
        {backLink}
        {loadFailed
          ? <LoadError message="Could not load this project for editing. Check your connection and try again." onRetry={() => setLoadAttempt((n) => n + 1)} />
          : <StatusNotice tone="loading" title="Loading the project" />}
      </>
    );
  }

  const budgetYears = Array.from(
    { length: Math.min(5, Math.max(1, parseInt(form.durationYears, 10) || 1)) },
    (_, i) => `year${i + 1}`
  );

  // The review step reports the totals; the table that produces them lives in
  // ProjectBudgetStep.
  const yTotal = (y) => yearTotal(form.budget, y, meta.budgetHeads);
  const gTotal = grandTotal(form.budget, meta.budgetHeads, budgetYears);

  const required = <span className="req" aria-hidden="true">*</span>;
  const namedMilestones = form.milestones.filter(m => m.name);

  // Each step is one panel: its title and purpose in the head, its groups as
  // sections. step.actions sits in the head, at the right.
  const step = (() => {
    switch (currentStep) {
      case 0: return {
        title: 'Step 1: Basic information',
        description: 'Initialize your research project by providing the mandatory core administrative details.',
        body: (
          <div className="cp-form-grid">
            <div className="cp-field full">
              <label htmlFor="create-project-project-title">Project title {required}</label>
              <input id="create-project-project-title" type="text" aria-required="true" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter the full formal title of the research project" />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-category">Category {required}</label>
              <select id="create-project-category" aria-required="true" value={form.category} onChange={e => updateField('category', e.target.value)}>
                <option value="">Select category</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-funding-agency">Funding agency {required}</label>
              <input id="create-project-funding-agency" type="text" aria-required="true" value={form.fundingAgency} onChange={e => updateField('fundingAgency', e.target.value)} placeholder="e.g. DST, CSIR, ISRO" />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-focus-area">Focus area</label>
              <input id="create-project-focus-area" type="text" value={form.focusArea} onChange={e => updateField('focusArea', e.target.value)} placeholder="e.g. AI/ML & IoT" />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-grant-type">Grant type</label>
              <input id="create-project-grant-type" type="text" value={form.grantType} onChange={e => updateField('grantType', e.target.value)} placeholder="e.g. CRG (Core Research Grant)" />
            </div>
            <div className="cp-field full">
              <label htmlFor="create-project-project-description">Project description</label>
              <textarea id="create-project-project-description" rows="4" value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Provide a brief abstract or summary of the research objectives and expected outcomes..." maxLength={2000} />
              <span className="cp-char-count">{form.description.length} / 2000 characters</span>
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-start-date">Start date {required}</label>
              <input id="create-project-start-date" type="date" aria-required="true" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-duration">Duration {required}</label>
              <div className="cp-duration-pair">
                <select id="create-project-duration" aria-required="true" value={form.durationYears} onChange={e => updateField('durationYears', e.target.value)} aria-label="Duration in years">
                  {meta.duration.years.map(y => <option key={y} value={y}>{y} {y === 1 ? 'Year' : 'Years'}</option>)}
                </select>
                <select value={form.durationMonths} onChange={e => updateField('durationMonths', e.target.value)} aria-label="Additional months">
                  {Array.from({ length: meta.duration.maxMonths + 1 }, (_, m) => (
                    <option key={m} value={m}>{m === 0 ? 'No extra months' : `${m} ${m === 1 ? 'Month' : 'Months'}`}</option>
                  ))}
                </select>
              </div>
              <span className="cp-duration-preview">{formatDuration(form.durationYears, form.durationMonths)}</span>
            </div>
            {form.endDate && (
              <div className="cp-field input-field-container">
                <label htmlFor="create-project-end-date">End date</label>
                <input id="create-project-end-date" type="date" value={form.endDate} readOnly className="field-readonly" />
              </div>
            )}
          </div>
        ),
      };

      case 1: return {
        title: 'Step 2: PI / Co-PI information',
        description: 'Define the project team structure and investigators.',
        body: (
          <>
            <PanelSection title="Principal investigator">
              {pi ? (
                <div className="cp-person">
                  <div className="cp-avatar" aria-hidden="true">{pi.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                  <div className="cp-person-info">
                    <p className="cp-person-name"><FacultyLink code={pi.id ?? pi.code} name={pi.name} /></p>
                    <p className="cp-person-dept">{pi.department}</p>
                    <p className="cp-person-meta">{pi.designation}</p>
                  </div>
                  <span className="badge badge--accent cp-person-role">PI</span>
                </div>
              ) : (
                <p className="cp-muted">No faculty record is linked to your account, so no PI can be set.</p>
              )}
              <div className="cp-form-grid cp-after">
                <div className="cp-field">
                  <label htmlFor="create-project-role-on-this-project">Role on this project</label>
                  <select id="create-project-role-on-this-project" value={form.role} onChange={e => updateField('role', e.target.value)}>
                    {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
            </PanelSection>
            <PanelSection
              title="Co-investigators"
              actions={<CustomButton text="Add external Co-PI" variant="secondary" size="sm" onClick={() => setShowExtForm(!showExtForm)} />}
            >
              <div className="cp-copi-search">
                <InputSuggestions
                  apiUrl={`${baseURL}/suggestions/faculty`}
                  label="Search internal faculty"
                  hint="Type faculty name, code or email..."
                  fields={['name', 'department']}
                  onSelect={addInternalCopi}
                />
              </div>
              {showExtForm && (
                <div className="cp-ext-form">
                  <p className="cp-ext-header"><span className="badge badge--purple">External partner</span></p>
                  <div className="cp-form-grid">
                    <div className="cp-field"><label htmlFor="create-project-full-name">Full name</label><input id="create-project-full-name" type="text" value={extCopi.name} onChange={e => setExtCopi({...extCopi, name: e.target.value})} placeholder="e.g. Prof. Robert Miller" /></div>
                    <div className="cp-field"><label htmlFor="create-project-designation">Designation</label><input id="create-project-designation" type="text" value={extCopi.designation} onChange={e => setExtCopi({...extCopi, designation: e.target.value})} placeholder="e.g. Associate Professor" /></div>
                    <div className="cp-field full"><label htmlFor="create-project-institute-organization">Institute / Organization</label><input id="create-project-institute-organization" type="text" value={extCopi.institute} onChange={e => setExtCopi({...extCopi, institute: e.target.value})} placeholder="e.g. MIT, Cambridge" /></div>
                    <div className="cp-field"><label htmlFor="create-project-email-address">Email address</label><input id="create-project-email-address" type="email" value={extCopi.email} onChange={e => setExtCopi({...extCopi, email: e.target.value})} /></div>
                    <div className="cp-field"><label htmlFor="create-project-mobile-number">Mobile number</label><input id="create-project-mobile-number" type="text" value={extCopi.mobile} onChange={e => setExtCopi({...extCopi, mobile: e.target.value})} /></div>
                    <div className="cp-field full"><label htmlFor="create-project-website">Website</label><input id="create-project-website" type="url" value={extCopi.website} onChange={e => setExtCopi({...extCopi, website: e.target.value})} /></div>
                  </div>
                  <div className="cp-inline-actions">
                    <CustomButton text="Add Co-PI" variant="secondary" size="sm" onClick={addExternalCopi} />
                    <CustomButton text="Cancel" variant="quiet" size="sm" onClick={() => setShowExtForm(false)} />
                  </div>
                </div>
              )}
              {form.coPIs.map((c, i) => (
                <div key={i} className={`cp-person cp-copi-row${lastAdded === `copi-${i}` ? ' just-added' : ''}`}>
                  <div className="cp-avatar" aria-hidden="true">{c.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                  <div className="cp-person-info">
                    <p className="cp-person-name">{c.name}</p>
                    <p className="cp-person-meta">{c.type === 'internal' ? c.department : c.institute} &middot; {c.type === 'internal' ? 'Internal' : 'External'}</p>
                  </div>
                  <button type="button" className="cp-remove-btn" onClick={() => removeCopi(i)} title="Remove Co-PI" aria-label={`Remove ${c.name}`}><i className="fa fa-trash" aria-hidden="true"></i></button>
                </div>
              ))}
            </PanelSection>
          </>
        ),
      };

      case 2: return {
        title: 'Step 3: Funding details',
        description: 'Configure the project budget and funding breakdown.',
        body: (
          <>
            <PanelSection title="Funding information">
              <div className="cp-form-grid">
                <div className="cp-field input-field-container"><label htmlFor="create-project-funding-agency-2">Funding agency</label><input id="create-project-funding-agency-2" type="text" value={form.fundingAgency} readOnly className="field-readonly" /></div>
                <div className="cp-field"><label htmlFor="create-project-total-sanctioned-amount">Total sanctioned amount (₹)</label><input id="create-project-total-sanctioned-amount" type="number" value={form.sanctionAmount} onChange={e => updateField('sanctionAmount', e.target.value)} placeholder="e.g. 4850000" /></div>
                <div className="cp-field"><label htmlFor="create-project-tiet-share">TIET share (₹)</label><input id="create-project-tiet-share" type="number" value={form.tietShare} onChange={e => updateField('tietShare', e.target.value)} /></div>
                <div className="cp-field"><label htmlFor="create-project-sanction-letter-link">Sanction letter link</label><input id="create-project-sanction-letter-link" type="url" value={form.sanctionLetterLink} onChange={e => updateField('sanctionLetterLink', e.target.value)} placeholder="https://..." /></div>
                <div className="cp-field">
                  <label htmlFor="create-project-sanction-letter-upload">Sanction letter upload</label>
                  <input id="create-project-sanction-letter-upload" type="file" accept=".pdf,.doc,.docx" ref={sanctionRef} onChange={handleSanctionFile} />
                  {form.sanctionLetterFileName && <span className="cp-file-hint"><i className="fa fa-paperclip" aria-hidden="true"></i> {form.sanctionLetterFileName}</span>}
                </div>
              </div>
            </PanelSection>
            <ProjectBudgetStep budget={form.budget} years={budgetYears} meta={meta} onChange={(next) => setForm(prev => ({ ...prev, budget: typeof next === 'function' ? next(prev.budget) : next }))} />
          </>
        ),
      };

      case 3: return {
        title: 'Step 4: Research objectives',
        description: 'Define clear, measurable goals and the SDGs this project contributes to.',
        body: (
          <>
            <PanelSection
              title="Objectives"
              actions={<CustomButton text="Add objective" variant="secondary" size="sm" onClick={() => setForm(p => ({ ...p, objectives: [...p.objectives, ''] }))} />}
            >
              <div className="cp-obj-list">
                {form.objectives.map((obj, i) => (
                  <div key={i} className="cp-obj-row">
                    <span className="cp-obj-num" aria-hidden="true">{i + 1}</span>
                    <input
                      type="text" value={obj} maxLength={500}
                      aria-label={`Objective ${i + 1}`}
                      placeholder="To develop ABC so as to improve XYZ."
                      onChange={e => setForm(p => ({ ...p, objectives: p.objectives.map((o, j) => (j === i ? e.target.value : o)) }))}
                    />
                    <button
                      type="button" className="cp-remove-btn" title="Remove objective" aria-label={`Remove objective ${i + 1}`}
                      disabled={form.objectives.length === 1}
                      onClick={() => removeObjective(i)}
                    >
                      <i className="fa fa-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                ))}
              </div>
            </PanelSection>
            <PanelSection
              title="Sustainable development goals"
              actions={<span className="cp-sdg-count">{form.sdgs.length} selected</span>}
            >
              <div className="cp-sdg-grid">
                {meta.sdgs.map(g => (
                  <label key={g.id} className={`cp-sdg-item${form.sdgs.includes(g.id) ? ' selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={form.sdgs.includes(g.id)}
                      onChange={() => updateField('sdgs', form.sdgs.includes(g.id)
                        ? form.sdgs.filter(id => id !== g.id)
                        : [...form.sdgs, g.id].sort((a, b) => a - b))}
                    />
                    <span className="cp-sdg-num">{g.id}</span>
                    <span className="cp-sdg-label">{g.label}</span>
                  </label>
                ))}
              </div>
            </PanelSection>
          </>
        ),
      };

      case 4: return {
        title: 'Step 5: Project milestones',
        description: 'Track timeline and deliverables.',
        actions: (
          <div className="cp-progress">
            <span className="cp-progress-label">Proposal completion</span>
            <div className="cp-progress-track" aria-hidden="true">
              <div className="cp-progress-fill" style={{width: `${milestoneProgress()}%`}}></div>
            </div>
            <span className="cp-progress-pct">{milestoneProgress()}% Structured</span>
          </div>
        ),
        body: (
          <>
            <PanelSection title="Gantt chart" description="The schedule behind the milestones below. PDF, image, spreadsheet or document, up to 10 MB.">
              <div className="cp-field">
                <input
                  type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx" ref={ganttRef}
                  aria-label="Gantt chart file"
                  onChange={e => {
                    const file = e.target.files[0];
                    if (file) setForm(p => ({ ...p, ganttFile: file, ganttFileName: file.name }));
                  }}
                />
                {form.ganttFileName && <span className="cp-file-hint"><i className="fa fa-paperclip" aria-hidden="true"></i> {form.ganttFileName}</span>}
              </div>
            </PanelSection>
            <PanelSection title="Milestones">
              <div className="cp-table-wrap">
                <table className="data-table cp-milestone-table">
                  <thead>
                    <tr><th>Milestone</th><th>Deliverable</th><th>Due date</th><th>Status</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {form.milestones.map((m, i) => (
                      <tr key={i} className={lastAdded === `milestone-${i}` ? 'just-added' : undefined}>
                        <td><input type="text" aria-label={`Milestone ${i + 1} name`} value={m.name} onChange={e => updateMilestone(i, 'name', e.target.value)} placeholder="e.g. Literature Review" /></td>
                        <td><input type="text" aria-label={`Milestone ${i + 1} deliverable`} value={m.deliverable} onChange={e => updateMilestone(i, 'deliverable', e.target.value)} placeholder="e.g. Draft Summary Report" /></td>
                        <td><input type="date" aria-label={`Milestone ${i + 1} due date`} value={m.dueDate} onChange={e => updateMilestone(i, 'dueDate', e.target.value)} /></td>
                        <td>
                          <select aria-label={`Milestone ${i + 1} status`} value={m.status} onChange={e => updateMilestone(i, 'status', e.target.value)} className="cp-ms-status">
                            {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          {form.milestones.length > 1 && <button type="button" className="cp-remove-btn" onClick={() => removeMilestone(i)} title="Remove milestone" aria-label={`Remove milestone ${i + 1}`}><i className="fa fa-trash" aria-hidden="true"></i></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button type="button" className="cp-add-row-btn" onClick={addMilestone}><i className="fa fa-plus" aria-hidden="true"></i> Add milestone row</button>
            </PanelSection>
          </>
        ),
      };

      case 5: return {
        title: 'Step 6: Review and submit',
        description: 'Review all details before submission.',
        body: (
          <div className="cp-review-grid">
            <section className="cp-review-block full">
              <h3 className="panel-section-title">Basic information</h3>
              <dl className="kv">
                <div><dt>Title</dt><dd>{form.title || EMPTY_VALUE}</dd></div>
                <div><dt>Category</dt><dd>{form.category || EMPTY_VALUE}</dd></div>
                <div><dt>Funding agency</dt><dd>{form.fundingAgency || EMPTY_VALUE}</dd></div>
                <div><dt>Duration</dt><dd>{formatDuration(form.durationYears, form.durationMonths)}{form.startDate ? ` · ${formatDate(form.startDate)} to ${formatDate(form.endDate)}` : ''}</dd></div>
                <div><dt>SDGs</dt><dd>{form.sdgs.length ? form.sdgs.map(id => (meta.sdgs.find(g => g.id === id) || {}).label).filter(Boolean).join(', ') : EMPTY_VALUE}</dd></div>
                <div><dt>Description</dt><dd className="cp-review-long">{form.description ? (form.description.length > 150 ? form.description.substring(0, 150) + '...' : form.description) : EMPTY_VALUE}</dd></div>
              </dl>
            </section>
            <section className="cp-review-block">
              <h3 className="panel-section-title">Team</h3>
              <dl className="kv">
                <div><dt>PI</dt><dd>{pi ? pi.name : EMPTY_VALUE}</dd></div>
                <div><dt>Your role</dt><dd>{form.role || EMPTY_VALUE}</dd></div>
                {form.coPIs.length > 0 ? (
                  form.coPIs.map((copi, idx) => (
                    <div key={idx}>
                      <dt>Co-PI {idx + 1}</dt>
                      <dd>{copi.name} ({copi.type === 'internal' ? 'Int' : 'Ext'})</dd>
                    </div>
                  ))
                ) : (
                  <div><dt>Co-PIs</dt><dd>None</dd></div>
                )}
              </dl>
            </section>
            <section className="cp-review-block">
              <h3 className="panel-section-title">Funding</h3>
              <dl className="kv">
                <div><dt>Sanctioned</dt><dd>₹{parseInt(form.sanctionAmount || 0).toLocaleString('en-IN')}</dd></div>
                <div><dt>TIET share</dt><dd>{form.tietShare === '' ? EMPTY_VALUE : `₹${parseInt(form.tietShare).toLocaleString('en-IN')}`}</dd></div>
                {budgetYears.map((y, i) => (
                  <div key={y}><dt>Year {i + 1} budget</dt><dd>₹{yTotal(y).toLocaleString('en-IN')}</dd></div>
                ))}
                <div><dt>Total budget</dt><dd>₹{gTotal.toLocaleString('en-IN')}</dd></div>
              </dl>
            </section>
            <section className="cp-review-block">
              <h3 className="panel-section-title">Objectives</h3>
              <dl className="kv">
                <div><dt>Objectives</dt><dd>{form.objectives.filter(o => o.trim()).length} listed</dd></div>
              </dl>
            </section>
            <section className="cp-review-block">
              <h3 className="panel-section-title">Milestones</h3>
              <dl className="kv">
                <div><dt>Overall progress</dt><dd>{milestoneProgress()}%</dd></div>
                {namedMilestones.length > 0 ? (
                  namedMilestones.slice(0, 3).map((ms, idx) => (
                    <div key={idx}>
                      <dt className="cp-review-clip">{ms.name}</dt>
                      <dd>{ms.status}</dd>
                    </div>
                  ))
                ) : (
                  <div><dt>Milestones</dt><dd>None</dd></div>
                )}
                {namedMilestones.length > 3 && (
                  <div><dt></dt><dd>+{namedMilestones.length - 3} more</dd></div>
                )}
              </dl>
            </section>
          </div>
        ),
      };

      default: return null;
    }
  })();

  const stepNav = (
    <>
      {currentStep > 0 && (
        <CustomButton text="Previous step" variant="quiet" onClick={() => setCurrentStep(currentStep - 1)} />
      )}
      {currentStep < STEPS.length - 1 ? (
        <CustomButton text="Continue" className="cp-nav-next" onClick={() => setCurrentStep(currentStep + 1)} />
      ) : (
        <CustomButton text={isEditMode ? 'Save changes' : 'Submit'} className="cp-nav-next" onClick={handleSubmit} busy={submitting} />
      )}
    </>
  );

  const stepper = (
    <nav className="cp-stepper-wrap" aria-label="Proposal steps">
      <div className="cp-stepper">
        {STEPS.map((stepName, i) => (
          <React.Fragment key={stepName}>
            <button
              type="button"
              className={`cp-step-dot ${i < currentStep ? 'done' : ''} ${i === currentStep ? 'active' : ''}`}
              onClick={() => setCurrentStep(i)}
              aria-current={i === currentStep ? 'step' : undefined}
              aria-label={`Step ${i + 1}: ${stepName}`}
            >
              {/* Both are drawn so a finished step's number can turn into the check. */}
              <span className="cp-step-num">{String(i + 1).padStart(2, '0')}</span>
              <i className="fa fa-check cp-step-check" aria-hidden="true"></i>
            </button>
            {i < STEPS.length - 1 && <div className={`cp-step-line ${i < currentStep ? 'done' : ''}`}></div>}
          </React.Fragment>
        ))}
      </div>
      <div className="cp-step-labels" aria-hidden="true">
        {STEPS.map((stepName, i) => (
          <span key={stepName} className={`cp-step-label ${i === currentStep ? 'active' : ''}`}>{stepName}</span>
        ))}
      </div>
    </nav>
  );

  return (
    <>
      {backLink}
      <Page
        className={isEditMode ? 'reveal' : undefined}
        title={isEditMode ? 'Edit project' : 'Create new project proposal'}
        meta={<span className="badge badge--accent">{isEditMode ? 'Editing' : 'Draft'}</span>}
        tabs={stepper}
      >
        <Panel title={step.title} description={step.description} actions={step.actions} footer={stepNav}>
          {step.body}
        </Panel>
      </Page>
    </>
  );
};

export default CreateProject;
