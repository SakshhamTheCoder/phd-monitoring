import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { categoryOptions, roleOptions, budgetHeadTemplate, milestoneStatusOptions, formatDate, subVal, subSum, cellMismatch, budgetMismatches, setSubCell } from '../../data/projectsData';
import { apiCreateProject, apiUpdateProjectFromForm, apiUpdateProject, apiCurrentFaculty } from '../../api/projects';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import './CreateProject.css';

const STEPS = ['Basic Info', 'Team', 'Budget', 'Objectives', 'Milestones', 'Review'];

const emptyForm = {
  title: '', category: '', role: 'PI', focusArea: '', grantType: '',
  fundingAgency: '', description: '',
  startDate: '', durationYears: 0, durationMonths: 0, endDate: '',
  coPIs: [],
  sanctionAmount: '', tietShare: '', sanctionLetterLink: '',
  sanctionLetterFile: null, sanctionLetterFileName: '',
  budget: { year1: {}, year2: {}, year3: {}, __subitems: {} },
  objectives: [{ title: '', description: '' }],
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
  durationYears: p.durationYears || 0,
  durationMonths: p.durationMonths || 0,
  endDate: p.endDate || '',
  coPIs: p.coPIs ? p.coPIs.map(c => ({ ...c })) : [],
  sanctionAmount: p.amount != null ? String(p.amount) : '',
  tietShare: p.tietShare != null ? String(p.tietShare) : '',
  // Only an external URL belongs in the link box; a stored file is a path, not a link.
  sanctionLetterLink: /^https?:\/\//i.test(p.sanctionLetterLink || '') ? p.sanctionLetterLink : '',
  sanctionLetterFile: null,
  sanctionLetterFileName: '',
  budget: {
    year1: p.budget?.year1 || {},
    year2: p.budget?.year2 || {},
    year3: p.budget?.year3 || {},
    __subitems: p.budget?.__subitems || {},
  },
  objectives: p.objectives?.length ? p.objectives.map(o => ({ ...o })) : [{ title: '', description: '' }],
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

  useEffect(() => {
    if (!pi) apiCurrentFaculty().then(f => f && setPi(f));
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

  const updateBudget = (year, head, value) => {
    setForm({ ...form, budget: { ...form.budget, [year]: { ...form.budget[year], [head]: parseFloat(value) || 0 } } });
  };

  const updateSubBudget = (year, head, sub, value) => {
    setForm(prev => ({ ...prev, budget: setSubCell(prev.budget, year, head, sub, value) }));
  };

  const handleSanctionFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setForm(prev => ({ ...prev, sanctionLetterFile: file, sanctionLetterFileName: file.name }));
  };

  const addObjective = () => setForm({ ...form, objectives: [...form.objectives, { title: '', description: '' }] });
  const removeObjective = (i) => setForm({ ...form, objectives: form.objectives.filter((_, idx) => idx !== i) });
  const updateObjective = (i, field, val) => {
    const objs = [...form.objectives];
    objs[i] = { ...objs[i], [field]: val };
    setForm({ ...form, objectives: objs });
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
    toast.success('Draft saved successfully!');
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
    const mismatched = budgetMismatches(form.budget);
    if (mismatched.length) {
      toast.error(`Sub-item totals don't match the head amount for: ${mismatched.join(', ')}.`);
      setCurrentStep(2);
      return;
    }
    setSubmitting(true);
    const res = isEditMode
      ? await apiUpdateProjectFromForm(editProject.id, form)
      : await apiCreateProject(form);
    if (res.success) await saveSanctionLetter(isEditMode ? editProject.id : res.project.id);
    setSubmitting(false);
    if (res.success) {
      toast.success(isEditMode ? 'Project updated successfully!' : 'Project created successfully!');
      navigate('/projects');
    }
  };

  const budgetYears = ['year1', 'year2', 'year3'];
  const budgetTotal = (year) => Object.values(form.budget[year] || {}).reduce((s, v) => s + (v || 0), 0);
  const grandTotal = budgetYears.reduce((s, y) => s + budgetTotal(y), 0);

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
              <label>Project Title <span className="req">*</span></label>
              <input type="text" value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Enter the full formal title of the research project" />
            </div>
            <div className="cp-field">
              <label>Category <span className="req">*</span></label>
              <select value={form.category} onChange={e => updateField('category', e.target.value)}>
                <option value="">Select category</option>
                {categoryOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label>Funding Agency <span className="req">*</span></label>
              <input type="text" value={form.fundingAgency} onChange={e => updateField('fundingAgency', e.target.value)} placeholder="e.g. DST, CSIR, ISRO" />
            </div>
            <div className="cp-field">
              <label>Focus Area</label>
              <input type="text" value={form.focusArea} onChange={e => updateField('focusArea', e.target.value)} placeholder="e.g. AI/ML & IoT" />
            </div>
            <div className="cp-field">
              <label>Grant Type</label>
              <input type="text" value={form.grantType} onChange={e => updateField('grantType', e.target.value)} placeholder="e.g. CRG (Core Research Grant)" />
            </div>
            <div className="cp-field full">
              <label>Project Description</label>
              <textarea rows="4" value={form.description} onChange={e => updateField('description', e.target.value)} placeholder="Provide a brief abstract or summary of the research objectives and expected outcomes..." maxLength={2000} />
              <span className="cp-char-count">{form.description.length} / 2000 characters</span>
            </div>
            <div className="cp-field">
              <label>Start Date <span className="req">*</span></label>
              <input type="date" value={form.startDate} onChange={e => updateField('startDate', e.target.value)} />
            </div>
            <div className="cp-field">
              <label>Duration (Years)</label>
              <select value={form.durationYears} onChange={e => updateField('durationYears', e.target.value)}>
                {[0,1,2,3,4,5,6,7,8,9,10].map(y => <option key={y} value={y}>{y} Years</option>)}
              </select>
            </div>
            <div className="cp-field">
              <label>Duration (Months)</label>
              <select value={form.durationMonths} onChange={e => updateField('durationMonths', e.target.value)}>
                {[0,1,2,3,4,5,6,7,8,9,10,11].map(m => <option key={m} value={m}>{m} Months</option>)}
              </select>
            </div>
            {form.endDate && (
              <div className="cp-field">
                <label>End Date</label>
                <input type="date" value={form.endDate} readOnly className="cp-readonly" />
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
                <label>Role on this project</label>
                <select value={form.role} onChange={e => updateField('role', e.target.value)}>
                  {roleOptions.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Co-PIs */}
          <div className="cp-section-card">
            <div className="cp-section-header-row">
              <h3 className="cp-section-title">Co-Investigators</h3>
              <button className="cp-add-btn" onClick={() => setShowExtForm(!showExtForm)}>
                <i className="fa fa-plus"></i> Add Co-PI
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
                  <div className="cp-field"><label>Full Name</label><input type="text" value={extCopi.name} onChange={e => setExtCopi({...extCopi, name: e.target.value})} placeholder="e.g. Prof. Robert Miller" /></div>
                  <div className="cp-field"><label>Designation</label><input type="text" value={extCopi.designation} onChange={e => setExtCopi({...extCopi, designation: e.target.value})} placeholder="e.g. Associate Professor" /></div>
                  <div className="cp-field full"><label>Institute / Organization</label><input type="text" value={extCopi.institute} onChange={e => setExtCopi({...extCopi, institute: e.target.value})} placeholder="e.g. MIT, Cambridge" /></div>
                  <div className="cp-field"><label>Email Address</label><input type="email" value={extCopi.email} onChange={e => setExtCopi({...extCopi, email: e.target.value})} /></div>
                  <div className="cp-field"><label>Mobile Number</label><input type="text" value={extCopi.mobile} onChange={e => setExtCopi({...extCopi, mobile: e.target.value})} /></div>
                  <div className="cp-field full"><label>Website</label><input type="url" value={extCopi.website} onChange={e => setExtCopi({...extCopi, website: e.target.value})} /></div>
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
              <div className="cp-field"><label>Funding Agency</label><input type="text" value={form.fundingAgency} readOnly className="cp-readonly" /></div>
              <div className="cp-field"><label>Total Sanctioned Amount (₹)</label><input type="number" value={form.sanctionAmount} onChange={e => updateField('sanctionAmount', e.target.value)} placeholder="e.g. 4850000" /></div>
              <div className="cp-field"><label>TIET Share (₹)</label><input type="number" value={form.tietShare} onChange={e => updateField('tietShare', e.target.value)} /></div>
              <div className="cp-field"><label>Sanction Letter Link</label><input type="url" value={form.sanctionLetterLink} onChange={e => updateField('sanctionLetterLink', e.target.value)} placeholder="https://..." /></div>
              <div className="cp-field">
                <label>Sanction Letter Upload</label>
                <input type="file" accept=".pdf,.doc,.docx" ref={sanctionRef} onChange={handleSanctionFile} />
                {form.sanctionLetterFileName && <span className="cp-file-hint"><i className="fa fa-check-circle"></i> {form.sanctionLetterFileName}</span>}
              </div>
            </div>
          </div>
          <div className="cp-section-card">
            <h3 className="cp-section-title">Budget Breakdown</h3>
            <div className="cp-budget-table-wrap">
              <table className="cp-budget-table">
                <thead>
                  <tr>
                    <th>Budget Head</th>
                    {budgetYears.map((y, i) => <th key={y}>Year {i + 1} (₹)</th>)}
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetHeadTemplate.map(bh => (
                    <React.Fragment key={bh.head}>
                      <tr className="cp-budget-head-row">
                        <td className="cp-budget-head-name">{bh.head}</td>
                        {budgetYears.map(y => (
                          <td key={y}>
                            <input
                              type="number"
                              className={`cp-budget-input${bh.subItems.length && cellMismatch(form.budget, y, bh.head) ? ' cp-budget-mismatch' : ''}`}
                              value={form.budget[y]?.[bh.head] || ''}
                              onChange={e => updateBudget(y, bh.head, e.target.value)}
                              placeholder="0"
                            />
                          </td>
                        ))}
                        <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + (form.budget[y]?.[bh.head] || 0), 0).toLocaleString('en-IN')}</td>
                      </tr>
                      {bh.subItems.map(sub => (
                        <tr key={sub} className="cp-budget-sub-row">
                          <td className="cp-budget-sub-name">↳ {sub}</td>
                          {budgetYears.map(y => (
                            <td key={y}>
                              <input
                                type="number"
                                className="cp-budget-input sub"
                                value={subVal(form.budget, y, bh.head, sub) || ''}
                                onChange={e => updateSubBudget(y, bh.head, sub, e.target.value)}
                                placeholder="0"
                              />
                            </td>
                          ))}
                          <td className="cp-budget-total">₹{budgetYears.reduce((s, y) => s + subVal(form.budget, y, bh.head, sub), 0).toLocaleString('en-IN')}</td>
                        </tr>
                      ))}
                      {bh.subItems.length > 0 && (
                        <tr className="cp-budget-sub-row">
                          <td className="cp-budget-sub-name">↳ sub-items total</td>
                          {budgetYears.map(y => {
                            const ss = subSum(form.budget, y, bh.head);
                            const bad = cellMismatch(form.budget, y, bh.head);
                            return <td key={y} className={`cp-budget-subsum${bad ? ' bad' : (ss > 0 ? ' ok' : '')}`}>₹{ss.toLocaleString('en-IN')}{bad ? ' ⚠' : (ss > 0 ? ' ✓' : '')}</td>;
                          })}
                          <td></td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                  <tr className="cp-budget-grand-row">
                    <td><strong>Grand Total</strong></td>
                    {budgetYears.map(y => <td key={y} className="cp-budget-total">₹{budgetTotal(y).toLocaleString('en-IN')}</td>)}
                    <td className="cp-budget-grand">₹{grandTotal.toLocaleString('en-IN')}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      );

      case 3: return (
        <div className="cp-step-content">
          <div className="cp-step-header">
            <h2><i className="fa fa-bullseye"></i> Step 4: Research Objectives</h2>
            <p>Define clear, measurable goals for your project proposal.</p>
          </div>
          <div className="cp-section-card">
            <div className="cp-section-header-row">
              <h3 className="cp-section-title">Objectives</h3>
              <button className="cp-add-btn" onClick={addObjective}><i className="fa fa-plus"></i> Add Objective</button>
            </div>
            {form.objectives.map((obj, i) => (
              <div key={i} className="cp-objective-card">
                <div className="cp-form-grid">
                  <div className="cp-field">
                    <label>Objective Title</label>
                    <input type="text" value={obj.title} onChange={e => updateObjective(i, 'title', e.target.value)} placeholder="e.g. Quantum Neural Optimization" />
                  </div>
                  <div className="cp-field" style={{flex: 2}}>
                    <label>Description</label>
                    <textarea rows="3" value={obj.description} onChange={e => updateObjective(i, 'description', e.target.value)} placeholder="Describe the objective..." />
                  </div>
                </div>
                {form.objectives.length > 1 && (
                  <button className="cp-remove-btn obj" onClick={() => removeObjective(i)}><i className="fa fa-trash"></i></button>
                )}
              </div>
            ))}
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
              <div className="cp-review-row"><span>Title</span><strong>{form.title || '—'}</strong></div>
              <div className="cp-review-row"><span>Category</span><strong>{form.category || '—'}</strong></div>
              <div className="cp-review-row"><span>Funding Agency</span><strong>{form.fundingAgency || '—'}</strong></div>
              <div className="cp-review-row"><span>Duration</span><strong>{form.startDate ? formatDate(form.startDate) : '—'} to {form.endDate ? formatDate(form.endDate) : '—'} ({form.durationYears}Y {form.durationMonths}M)</strong></div>
              <div className="cp-review-row"><span>Description</span><strong style={{ textAlign: 'right', maxWidth: '75%', fontWeight: '500', fontSize: '0.8rem', lineHeight: '1.4' }}>{form.description ? (form.description.length > 150 ? form.description.substring(0, 150) + '...' : form.description) : '—'}</strong></div>
            </div>
            <div className="cp-review-card">
              <h4>Team</h4>
              <div className="cp-review-row"><span>PI</span><strong>{pi ? pi.name : '—'}</strong></div>
              <div className="cp-review-row"><span>Your Role</span><strong>{form.role || '—'}</strong></div>
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
              <div className="cp-review-row"><span>Budget Total</span><strong>₹{grandTotal.toLocaleString('en-IN')}</strong></div>
              {budgetYears.map((y, i) => {
                const yTotal = budgetTotal(y);
                return yTotal > 0 ? (
                  <div key={y} className="cp-review-row"><span>Year {i + 1} Budget</span><strong>₹{yTotal.toLocaleString('en-IN')}</strong></div>
                ) : null;
              })}
            </div>
            <div className="cp-review-card">
              <h4>Objectives</h4>
              {form.objectives.filter(o => o.title).length > 0 ? (
                form.objectives.filter(o => o.title).map((obj, idx) => (
                  <div key={idx} className="cp-review-row">
                    <span>Obj {idx + 1}</span>
                    <strong style={{ maxWidth: '65%', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{obj.title}</strong>
                  </div>
                ))
              ) : (
                <div className="cp-review-row"><span>Objectives</span><strong>None</strong></div>
              )}
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
        <button className="cp-back-link" onClick={() => navigate('/projects')}>
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
              <div className={`cp-step-dot ${i < currentStep ? 'done' : ''} ${i === currentStep ? 'active' : ''}`} onClick={() => setCurrentStep(i)}>
                {i < currentStep ? <i className="fa fa-check"></i> : <span>{String(i + 1).padStart(2, '0')}</span>}
              </div>
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
