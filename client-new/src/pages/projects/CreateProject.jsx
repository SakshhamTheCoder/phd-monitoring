import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import {
  categoryOptions,
  roleOptions,
  milestoneStatusOptions,
  formatDuration,
  yearTotal,
  grandTotal,
  emptyBudget,
} from '../../data/projectsData';
import { formatDate, EMPTY_VALUE } from '../../utils/timeParse';
import { apiCreateProject, apiUpdateProjectFromForm, apiUpdateProject, apiCurrentFaculty, apiProjectMeta, apiUploadGanttChart } from '../../api/projects';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import ProjectBudgetStep from './ProjectBudgetStep';
import './CreateProject.css';

const STEPS = ['Basic Info', 'Team', 'Budget', 'Objectives', 'Milestones', 'Review'];

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
  const [form, setForm] = useState(() => (editProject ? buildFormFromProject(editProject) : { ...emptyForm }));
  const [showExtForm, setShowExtForm] = useState(false);
  const [extCopi, setExtCopi] = useState({ name: '', designation: '', institute: '', email: '', mobile: '', website: '' });
  const [pi, setPi] = useState(editProject?.pi || null);
  const sanctionRef = useRef(null);
  const ganttRef = useRef(null);
  const [meta, setMeta] = useState({ sdgs: [], manpowerCategories: [], budgetHeads: [], duration: { years: [0,1,2,3,4,5], maxMonths: 11 } });

  useEffect(() => {
    if (!pi) apiCurrentFaculty().then(f => f && setPi(f));
    apiProjectMeta().then(setMeta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateField = (field, value) => {
    const updated = { ...form, [field]: value };
    if (field === 'startDate' || field === 'durationYears' || field === 'durationMonths') {
      const sd = field === 'startDate' ? value : form.startDate;
      const dy = field === 'durationYears' ? parseInt(value) || 0 : parseInt(form.durationYears) || 0;
      const dm = field === 'durationMonths' ? parseInt(value) || 0 : parseInt(form.durationMonths) || 0;
      if (sd) {
        const d = new Date(sd);
        d.setFullYear(d.getFullYear() + dy);
        d.setMonth(d.getMonth() + dm);
        updated.endDate = d.toISOString().split('T')[0];
      }
    }
    setForm(updated);
  };

  const addInternalCopi = (fac) => {
    if (!fac || !fac.name) return;
    if (form.coPIs.find(c => c.name === fac.name)) return;
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
      setForm({ ...form, coPIs: [...form.coPIs, { type: 'external', ...extCopi }] });
      setExtCopi({ name: '', designation: '', institute: '', email: '', mobile: '', website: '' });
      setShowExtForm(false);
    }
  };

  const removeCopi = (idx) => setForm({ ...form, coPIs: form.coPIs.filter((_, i) => i !== idx) });

  const handleSanctionFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setForm(prev => ({ ...prev, sanctionLetterFile: file, sanctionLetterFileName: file.name }));
  };

  const addMilestone = () => setForm({ ...form, milestones: [...form.milestones, { name: '', deliverable: '', dueDate: '', status: 'Not Started' }] });
  const removeMilestone = (i) => setForm({ ...form, milestones: form.milestones.filter((_, idx) => idx !== i) });
  const updateMilestone = (i, field, val) => {
    const ms = [...form.milestones];
    ms[i] = { ...ms[i], [field]: val };
    setForm({ ...form, milestones: ms });
  };

  const milestoneProgress = () => {
    const done = form.milestones.filter(m => m.status === 'Completed').length;
    return form.milestones.length ? Math.round((done / form.milestones.length) * 100) : 0;
  };

  const saveDraft = () => {
    localStorage.setItem('projectDraft', JSON.stringify(form));
    toast.success('Draft saved.');
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

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const res = isEditMode
      ? await apiUpdateProjectFromForm(editProject.id, form)
      : await apiCreateProject(form);
    if (res.success) {
      const projectId = isEditMode ? editProject.id : res.project.id;
      await saveSanctionLetter(projectId);
      if (form.ganttFile && (res.project?.id || projectId)) {
        await apiUploadGanttChart(res.project?.id || projectId, form.ganttFile);
      }
    }
    setSubmitting(false);
    if (res.success) {
      toast.success(isEditMode ? 'Project updated.' : 'Project created.');
      navigate('/projects');
    }
  };

  // Derived from the chosen duration (1-5 years) so the wizard's year columns
  // match the Grand Total's real year list. Shrinking the duration only
  // hides the extra columns here — it never deletes the budget data stored
  // under those years.
  const budgetYears = Array.from(
    { length: Math.min(5, Math.max(1, parseInt(form.durationYears, 10) || 1)) },
    (_, i) => `year${i + 1}`
  );

  // The review step reports the totals; the table that produces them lives in
  // ProjectBudgetStep.
  const yTotal = (y) => yearTotal(form.budget, y, meta.budgetHeads);
  const gTotal = grandTotal(form.budget, meta.budgetHeads, budgetYears);

  const renderStep = () => {
    switch (currentStep) {
      case 0: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <h2><i className="fa fa-info-circle"></i> Step 1: Basic Information</h2>
            <p>Initialize your research project by providing the mandatory core administrative details.</p>
          </div>
          <div className="cp-form-grid">
            <div className="cp-field full">
              <label htmlFor="create-project-project-title">Project Title <span className="req">*</span></label>
              <input id="create-project-project-title" type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter the full formal title of the research project" />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-category">Category <span className="req">*</span></label>
              <select id="create-project-category" value={form.category} onChange={e => updateField('category', e.target.value)}>
                <option value="">Select category</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-funding-agency">Funding Agency <span className="req">*</span></label>
              <input id="create-project-funding-agency" type="text" value={form.fundingAgency} onChange={e => updateField('fundingAgency', e.target.value)} placeholder="e.g. DST, CSIR, ISRO" />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-focus-area">Focus Area</label>
              <input id="create-project-focus-area" type="text" value={form.focusArea} onChange={e => updateField('focusArea', e.target.value)} placeholder="e.g. AI/ML & IoT" />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-grant-type">Grant Type</label>
              <input id="create-project-grant-type" type="text" value={form.grantType} onChange={e => updateField('grantType', e.target.value)} placeholder="e.g. CRG (Core Research Grant)" />
            </div>
            <div className="cp-field full">
              <label htmlFor="create-project-project-description">Project Description</label>
              <textarea id="create-project-project-description" rows="4" value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Provide a brief abstract or summary of the research objectives and expected outcomes..." maxLength={2000} />
              <span className="cp-char-count">{form.description.length} / 2000 characters</span>
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-start-date">Start Date <span className="req">*</span></label>
              <input id="create-project-start-date" type="date" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} />
            </div>
            <div className="cp-field">
              <label htmlFor="create-project-duration">Duration <span className="req">*</span></label>
              <div className="cp-duration-pair">
                <select value={form.durationYears} onChange={e => updateField('durationYears', e.target.value)} aria-label="Duration in years">
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
              <div className="cp-field">
                <label htmlFor="create-project-end-date">End Date</label>
                <input id="create-project-end-date" id="create-project-duration" type="date" value={form.endDate} readOnly className="cp-readonly" />
              </div>
            )}
          </div>
        </div>
      );

      case 1: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <h2><i className="fa fa-users"></i> Step 2: PI / Co-PI Information</h2>
            <p>Define the project team structure and investigators.</p>
          </div>
          {/* PI Section */}
          <div className="cp-section-card">
            <h3 className="cp-section-title">Principal Investigator</h3>
            {pi ? (
              <div className="cp-pi-card">
                <div className="cp-pi-avatar">{pi.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                <div className="cp-pi-info">
                  <h4><FacultyLink code={pi.id} name={pi.name} /></h4>
                  <p className="cp-pi-dept">{pi.department}</p>
                  <p className="cp-pi-meta">{pi.designation}</p>
                </div>
                <span className="badge badge--accent">PI</span>
              </div>
            ) : (
              <p className="cp-pi-none">No faculty record is linked to your account, so no PI can be set.</p>
            )}
            <div className="cp-form-grid">
              <div className="cp-field">
                <label htmlFor="create-project-role-on-this-project">Role on this project</label>
                <select id="create-project-role-on-this-project" value={form.role} onChange={e => updateField('role', e.target.value)}>
                  {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Co-PIs */}
          <div className="cp-section-card">
            <div className="cp-section-header-row">
              <h3 className="cp-section-title">Co-Investigators</h3>
              <button className="inline-add-btn" onClick={() => setShowExtForm(!showExtForm)}>
                <i className="fa fa-plus"></i> Add External Co-PI
              </button>
            </div>
            {/* Internal Search */}
            <div className="cp-copi-search">
              <InputSuggestions
                apiUrl={`${baseURL}/suggestions/faculty`}
                label="Search Internal Faculty"
                hint="Type faculty name, code or email..."
                fields={['name', 'department']}
                onSelect={addInternalCopi}
              />
            </div>
            {/* External Form */}
            {showExtForm && (
              <div className="cp-ext-form">
                <div className="cp-ext-header"><span className="cp-ext-label">External Partner</span></div>
                <div className="cp-form-grid">
                  <div className="cp-field"><label htmlFor="create-project-full-name">Full Name</label><input type="text" value={extCopi.name} onChange={e => setExtCopi({...extCopi, name: e.target.value})} placeholder="e.g. Prof. Robert Miller" /></div>
                  <div className="cp-field"><label htmlFor="create-project-designation">Designation</label><input type="text" value={extCopi.designation} onChange={e => setExtCopi({...extCopi, designation: e.target.value})} placeholder="e.g. Associate Professor" /></div>
                  <div className="cp-field full"><label htmlFor="create-project-institute-organization">Institute / Organization</label><input id="create-project-institute-organization" type="text" value={extCopi.institute} onChange={e => setExtCopi({...extCopi, institute: e.target.value})} placeholder="e.g. MIT, Cambridge" /></div>
                  <div className="cp-field"><label htmlFor="create-project-email-address">Email Address</label><input id="create-project-email-address" type="email" value={extCopi.email} onChange={e => setExtCopi({...extCopi, email: e.target.value})} /></div>
                  <div className="cp-field"><label htmlFor="create-project-mobile-number">Mobile Number</label><input id="create-project-mobile-number" type="text" value={extCopi.mobile} onChange={e => setExtCopi({...extCopi, mobile: e.target.value})} /></div>
                  <div className="cp-field full"><label htmlFor="create-project-website">Website</label><input id="create-project-website" type="url" value={extCopi.website} onChange={e => setExtCopi({...extCopi, website: e.target.value})} /></div>
                </div>
                <div className="cp-ext-actions">
                  <button className="cp-btn-outline" onClick={() => setShowExtForm(false)}>Cancel</button>
                  <button className="cp-btn-primary" onClick={addExternalCopi}>Save Co-PI</button>
                </div>
              </div>
            )}
            {/* Co-PI List */}
            {form.coPIs.map((c, i) => (
              <div key={i} className="cp-copi-row">
                <div className="cp-copi-avatar">{c.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
                <div className="cp-copi-info">
                  <strong>{c.name}</strong>
                  <span>{c.type === 'internal' ? c.department : c.institute} &middot; {c.type === 'internal' ? 'Internal' : 'External'}</span>
                </div>
                <button className="cp-remove-btn" onClick={() => removeCopi(i)}><i className="fa fa-trash"></i></button>
              </div>
            ))}
          </div>
        </div>
      );

      case 2: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <h2><i className="fa fa-inr"></i> Step 3: Funding Details</h2>
            <p>Configure the project budget and funding breakdown.</p>
          </div>
          <div className="cp-section-card">
            <h3 className="cp-section-title">Funding Information</h3>
            <div className="cp-form-grid">
              <div className="cp-field"><label htmlFor="create-project-funding-agency-2">Funding Agency</label><input id="create-project-funding-agency-2" type="text" value={form.fundingAgency} readOnly className="cp-readonly" /></div>
              <div className="cp-field"><label htmlFor="create-project-total-sanctioned-amount">Total Sanctioned Amount (₹)</label><input id="create-project-total-sanctioned-amount" type="number" value={form.sanctionAmount} onChange={e => updateField('sanctionAmount', e.target.value)} placeholder="e.g. 4850000" /></div>
              <div className="cp-field"><label htmlFor="create-project-tiet-share">TIET Share (₹)</label><input id="create-project-tiet-share" type="number" value={form.tietShare} onChange={e => updateField('tietShare', e.target.value)} /></div>
              <div className="cp-field"><label htmlFor="create-project-sanction-letter-link">Sanction Letter Link</label><input id="create-project-sanction-letter-link" type="url" value={form.sanctionLetterLink} onChange={e => updateField('sanctionLetterLink', e.target.value)} placeholder="https://..." /></div>
              <div className="cp-field">
                <label htmlFor="create-project-sanction-letter-upload">Sanction Letter Upload</label>
                <input id="create-project-sanction-letter-upload" id="create-project-designation" id="create-project-full-name" type="file" accept=".pdf,.doc,.docx" ref={sanctionRef} onChange={handleSanctionFile} />
                {form.sanctionLetterFileName && <span className="cp-file-hint"><i className="fa fa-check-circle"></i> {form.sanctionLetterFileName}</span>}
              </div>
            </div>
          </div>
          <ProjectBudgetStep budget={form.budget} years={budgetYears} meta={meta} onChange={(next) => setForm(prev => ({ ...prev, budget: next }))} />
        </div>
      );

      case 3: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <h2><i className="fa fa-bullseye"></i> Step 4: Research Objectives</h2>
            <p>Define clear, measurable goals and the SDGs this project contributes to.</p>
          </div>
          <div className="cp-section-card">
            <div className="cp-section-header-row">
              <h3 className="cp-section-title">Objectives</h3>
              <button className="inline-add-btn" onClick={() => setForm(p => ({ ...p, objectives: [...p.objectives, ''] }))}>
                <i className="fa fa-plus"></i> Add Objective
              </button>
            </div>
            <div className="cp-obj-list">
              {form.objectives.map((obj, i) => (
                <div key={i} className="cp-obj-row">
                  <span className="cp-obj-num">{i + 1}</span>
                  <input
                    type="text" value={obj} maxLength={500}
                    placeholder="To develop ABC so as to improve XYZ."
                    onChange={e => setForm(p => ({ ...p, objectives: p.objectives.map((o, j) => (j === i ? e.target.value : o)) }))}
                  />
                  <button
                    type="button" className="cp-remove-btn" title="Remove objective"
                    disabled={form.objectives.length === 1}
                    onClick={() => setForm(p => ({ ...p, objectives: p.objectives.filter((_, j) => j !== i) }))}
                  >
                    <i className="fa fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="cp-section-card">
            <div className="cp-section-header-row">
              <h3 className="cp-section-title">Sustainable Development Goals</h3>
              <span className="cp-sdg-count">{form.sdgs.length} selected</span>
            </div>
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
          </div>
        </div>
      );

      case 4: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <div>
              <h2><i className="fa fa-flag"></i> Step 5: Project Milestones</h2>
              <p>Track timeline and deliverables.</p>
            </div>
            <div className="cp-progress-badge">
              <span className="cp-progress-label">PROPOSAL COMPLETION</span>
              <div className="cp-progress-bar-mini">
                <div className="cp-progress-fill-mini" style={{width: `${milestoneProgress()}%`}}></div>
              </div>
              <span className="cp-progress-pct">{milestoneProgress()}% Structured</span>
            </div>
          </div>
          <div className="cp-section-card">
            <h3 className="cp-section-title">Gantt Chart</h3>
            <p className="cp-derived-note">The schedule behind the milestones below. PDF, image, spreadsheet or document, up to 10 MB.</p>
            <div className="cp-field">
              <input
                type="file" accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx" ref={ganttRef}
                onChange={e => {
                  const file = e.target.files[0];
                  if (file) setForm(p => ({ ...p, ganttFile: file, ganttFileName: file.name }));
                }}
              />
              {form.ganttFileName && <span className="cp-file-hint"><i className="fa fa-check-circle"></i> {form.ganttFileName}</span>}
            </div>
          </div>
          <div className="cp-section-card">
            <table className="cp-milestone-table">
              <thead>
                <tr><th>Milestone</th><th>Deliverable</th><th>Due Date</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                {form.milestones.map((m, i) => (
                  <tr key={i}>
                    <td><input type="text" value={m.name} onChange={e => updateMilestone(i, 'name', e.target.value)} placeholder="e.g. Literature Review" /></td>
                    <td><input type="text" value={m.deliverable} onChange={e => updateMilestone(i, 'deliverable', e.target.value)} placeholder="e.g. Draft Summary Report" /></td>
                    <td><input type="date" value={m.dueDate} onChange={e => updateMilestone(i, 'dueDate', e.target.value)} /></td>
                    <td>
                      <select value={m.status} onChange={e => updateMilestone(i, 'status', e.target.value)} className={`cp-ms-status ${m.status.toLowerCase().replace(' ', '-')}`}>
                        {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      {form.milestones.length > 1 && <button className="cp-remove-btn" onClick={() => removeMilestone(i)}><i className="fa fa-trash"></i></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="cp-add-row-btn" onClick={addMilestone}><i className="fa fa-plus"></i> Add Milestone Row</button>
          </div>
        </div>
      );

      case 5: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <h2><i className="fa fa-check-square"></i> Step 6: Review & Submit</h2>
            <p>Review all details before submission.</p>
          </div>
          <div className="cp-review-grid">
            <div className="cp-review-card" style={{ gridColumn: '1 / -1' }}>
              <h4>Basic Information</h4>
              <div className="cp-review-row"><span>Title</span><strong>{form.title || EMPTY_VALUE}</strong></div>
              <div className="cp-review-row"><span>Category</span><strong>{form.category || EMPTY_VALUE}</strong></div>
              <div className="cp-review-row"><span>Funding Agency</span><strong>{form.fundingAgency || EMPTY_VALUE}</strong></div>
              <div className="cp-review-row"><span>Duration</span><strong>{formatDuration(form.durationYears, form.durationMonths)}{form.startDate ? ` · ${formatDate(form.startDate)} to ${formatDate(form.endDate)}` : ''}</strong></div>
              <div className="cp-review-row"><span>SDGs</span><strong>{form.sdgs.length ? form.sdgs.map(id => (meta.sdgs.find(g => g.id === id) || {}).label).filter(Boolean).join(', ') : EMPTY_VALUE}</strong></div>
              <div className="cp-review-row"><span>Description</span><strong style={{ textAlign: 'right', maxWidth: '75%', fontWeight: '500', fontSize: '0.8rem', lineHeight: '1.4' }}>{form.description ? (form.description.length > 150 ? form.description.substring(0, 150) + '...' : form.description) : EMPTY_VALUE}</strong></div>
            </div>
            <div className="cp-review-card">
              <h4>Team</h4>
              <div className="cp-review-row"><span>PI</span><strong>{pi ? pi.name : EMPTY_VALUE}</strong></div>
              <div className="cp-review-row"><span>Your Role</span><strong>{form.role || EMPTY_VALUE}</strong></div>
              {form.coPIs.length > 0 ? (
                form.coPIs.map((copi, idx) => (
                  <div key={idx} className="cp-review-row">
                    <span>Co-PI {idx + 1}</span>
                    <strong>{copi.name} ({copi.type === 'internal' ? 'Int' : 'Ext'})</strong>
                  </div>
                ))
              ) : (
                <div className="cp-review-row"><span>Co-PIs</span><strong>None</strong></div>
              )}
            </div>
            <div className="cp-review-card">
              <h4>Funding</h4>
              <div className="cp-review-row"><span>Sanctioned</span><strong>₹{parseInt(form.sanctionAmount || 0).toLocaleString('en-IN')}</strong></div>
              <div className="cp-review-row"><span>TIET Share</span><strong>₹{parseInt(form.tietShare || 0).toLocaleString('en-IN')}</strong></div>
              {budgetYears.map((y, i) => (
                <div key={y} className="cp-review-row"><span>Year {i + 1} Budget</span><strong>₹{yTotal(y).toLocaleString('en-IN')}</strong></div>
              ))}
              <div className="cp-review-row"><span>Total Budget</span><strong>₹{gTotal.toLocaleString('en-IN')}</strong></div>
            </div>
            <div className="cp-review-card">
              <h4>Objectives</h4>
              <div className="cp-review-row"><span>Objectives</span><strong>{form.objectives.filter(o => o.trim()).length} listed</strong></div>
            </div>
            <div className="cp-review-card">
              <h4>Milestones</h4>
              <div className="cp-review-row"><span>Overall Progress</span><strong>{milestoneProgress()}%</strong></div>
              {form.milestones.filter(m => m.name).length > 0 ? (
                form.milestones.filter(m => m.name).slice(0, 3).map((ms, idx) => (
                  <div key={idx} className="cp-review-row">
                    <span style={{ maxWidth: '60%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ms.name}</span>
                    <strong>{ms.status}</strong>
                  </div>
                ))
              ) : (
                <div className="cp-review-row"><span>Milestones</span><strong>None</strong></div>
              )}
              {form.milestones.filter(m => m.name).length > 3 && (
                <div className="cp-review-row"><span></span><strong>+{form.milestones.filter(m => m.name).length - 3} more</strong></div>
              )}
            </div>
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <Layout>
      <div className="cp-container">
        <button className="page-back-link" onClick={() => navigate('/projects')}>
          <i className="fa fa-arrow-left"></i> BACK TO PROJECTS
        </button>
        <div className="cp-wizard-header">
          <h1 className="page-title">{isEditMode ? 'Edit Project' : 'Create New Project Proposal'}</h1>
          <span className="cp-draft-badge">{isEditMode ? 'EDITING' : 'DRAFT'}</span>
        </div>
        {/* Stepper */}
        <div className="cp-stepper">
          {STEPS.map((step, i) => (
            <React.Fragment key={step}>
              <button
                type="button"
                className={`cp-step-dot ${i < currentStep ? 'done' : ''} ${i === currentStep ? 'active' : ''}`}
                onClick={() => setCurrentStep(i)}
                aria-current={i === currentStep ? 'step' : undefined}
                aria-label={`Step ${i + 1}: ${step}`}
              >
                {i < currentStep ? <i className="fa fa-check"></i> : <span>{String(i + 1).padStart(2, '0')}</span>}
              </button>
              {i < STEPS.length - 1 && <div className={`cp-step-line ${i < currentStep ? 'done' : ''}`}></div>}
            </React.Fragment>
          ))}
        </div>
        <div className="cp-step-labels">
          {STEPS.map((step, i) => (
            <span key={step} className={`cp-step-label ${i === currentStep ? 'active' : ''}`}>{step}</span>
          ))}
        </div>

        {renderStep()}

        {/* Navigation */}
        <div className="cp-nav-footer">
          {currentStep > 0 && (
            <button className="cp-btn-outline" onClick={() => setCurrentStep(currentStep - 1)}>
              <i className="fa fa-chevron-left"></i> Previous Step
            </button>
          )}
          <div className="cp-nav-right">
            <button className="cp-btn-draft" onClick={saveDraft}>
              <i className="fa fa-file-text-o"></i> Save Draft
            </button>
            {currentStep < STEPS.length - 1 ? (
              <button className="cp-btn-primary" onClick={() => setCurrentStep(currentStep + 1)}>
                Continue <i className="fa fa-chevron-right"></i>
              </button>
            ) : (
              <button className="cp-btn-primary" onClick={handleSubmit} disabled={submitting}>
                <i className={`fa ${isEditMode ? 'fa-save' : 'fa-paper-plane'}`}></i> {isEditMode ? 'Save Changes' : 'Submit'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CreateProject;
