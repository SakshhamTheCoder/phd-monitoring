import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  formatCurrency,
  getMilestoneProgress,
  milestoneStatusOptions,
  formatDuration,
} from '../../data/projectsData';
import { formatDate, EMPTY_VALUE } from '../../utils/timeParse';
import { badgeClass } from '../../data/badges';
import { apiGetProject, apiUpdateProject, apiAddMilestone, apiUpdateMilestone, apiAddDocument, apiUpdateDocument, apiDeleteDocument, fileUrl, mapMilestone, mapDocument, apiProjectMeta, apiUploadGanttChart } from '../../api/projects';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import CustomModal from '../../components/forms/modal/CustomModal';
import Tabs from '../../components/tabs/Tabs';
import CustomButton from '../../components/forms/fields/CustomButton';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import ProjectBudgetCard from './ProjectBudgetCard';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel, { PanelSection } from '../../components/panel/Panel';
import './ProjectDetails.css';
import { useFeatures } from '../../context/FeaturesContext';
import useDoneFlash from '../../hooks/useDoneFlash';

// Build the sanction-letter display object from a loaded project.
const sanctionFromProject = (p) => {
  if (!p || !p.sanctionLetterLink || p.sanctionLetterLink === '#') return null;
  const isLink = /^https?:\/\//i.test(p.sanctionLetterLink);
  return { name: p.sanctionLetterName || 'Sanction Letter', url: fileUrl(p.sanctionLetterLink), isLink };
};

const TABS = ['Overview', 'Funding and budget', 'Milestones', 'Project team', 'Documents'];

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const features = useFeatures();
  const [activeTab, setActiveTab] = useState('Overview');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  // One flag for the add and upload saves below: a second click while the
  // first was on its way posted a second milestone or document.
  const [saving, setSaving] = useState(false);
  const whileSaving = async (task) => {
    if (saving) return;
    setSaving(true);
    try { await task(); } finally { setSaving(false); }
  };
  const [milestones, setMilestones] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMs, setNewMs] = useState({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
  // Declared with the rest of the state, because manpowerCats reads it a few
  // hundred lines above where it used to sit. A const is in scope for the whole
  // function but unreadable until its declaration runs, so every render threw
  // "Cannot access 'meta' before initialization" and the page never drew.
  const [meta, setMeta] = useState({ sdgs: [], manpowerCategories: [], budgetHeads: [], duration: { years: [1, 2, 3, 4, 5], maxMonths: 11 } });
  useEffect(() => { apiProjectMeta().then(setMeta); }, []);

  const validateMilestone = (m) => {
    if (!m.name.trim()) { toast.error('Milestone name is required.'); return false; }
    if (!m.deliverable.trim()) { toast.error('Deliverable is required.'); return false; }
    if (!m.dueDate) { toast.error('Due date is required.'); return false; }
    return true;
  };
  const startEdit = (i) => { setEditingIdx(i); setEditForm({ ...milestones[i] }); };
  const cancelEdit = () => { setEditingIdx(null); };
  const saveEdit = async () => {
    if (!validateMilestone(editForm)) return;
    const res = await apiUpdateMilestone(project.id, milestones[editingIdx].id, editForm);
    if (res.success) {
      setMilestones(prev => prev.map((x, i) => (i === editingIdx ? { ...x, ...editForm } : x)));
      setEditingIdx(null);
      toast.success('Milestone updated.');
    }
  };
  const addMilestone = async () => {
    if (!validateMilestone(newMs)) return;
    await whileSaving(async () => {
      const res = await apiAddMilestone(project.id, newMs);
      if (res.success) {
        setMilestones(prev => [...prev, mapMilestone(res.response)]);
        setNewMs({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
        setShowAddForm(false);
        toast.success('Milestone added.');
      }
    });
  };

  // Budget breakdown inline editing (heads + sub-items, kept reconciled).
  // Sub-item amounts live under a reserved `__subitems` key: budget.__subitems[year][head][sub].
  const [budgetData, setBudgetData] = useState({});
  const emptyCopi = { name: '', type: 'internal', faculty_code: null, department: '', institute: '', designation: '' };
  const pickInternal = (setter) => (fac) => {
    if (!fac || !fac.id) return;
    setter(prev => ({
      ...prev, type: 'internal', faculty_code: fac.id,
      name: fac.name, department: fac.department, designation: fac.designation,
    }));
  };
  const [coPIs, setCoPIs] = useState([]);
  const [showCopiForm, setShowCopiForm] = useState(false);
  const [newCopi, setNewCopi] = useState(emptyCopi);
  const invalidCopi = (c) => {
    if (c.type === 'internal' && !c.faculty_code) { toast.error('Pick a faculty member from the suggestions.'); return true; }
    if (!c.name.trim()) { toast.error('A name is required.'); return true; }
    return false;
  };
  const addCopi = async () => {
    if (invalidCopi(newCopi)) return;
    const updated = [...coPIs, { ...newCopi }];
    const res = await apiUpdateProject(project.id, { co_pis: updated });
    if (res.success) { setCoPIs(updated); setNewCopi(emptyCopi); setShowCopiForm(false); toast.success('Co-PI added.'); }
  };
  const removeCopi = async (i) => {
    if (!window.confirm('Are you sure you want to remove this Co-PI?')) return;
    const updated = coPIs.filter((_, idx) => idx !== i);
    const res = await apiUpdateProject(project.id, { co_pis: updated });
    if (res.success) { setCoPIs(updated); toast.success('Co-PI removed.'); }
  };
  const [editingCopiIdx, setEditingCopiIdx] = useState(null);
  const [copiEditForm, setCopiEditForm] = useState(emptyCopi);
  const startCopiEdit = (i) => { setEditingCopiIdx(i); setCopiEditForm({ ...emptyCopi, ...coPIs[i] }); };
  const cancelCopiEdit = () => setEditingCopiIdx(null);
  const saveCopiEdit = async () => {
    if (invalidCopi(copiEditForm)) return;
    const updated = coPIs.map((c, idx) => (idx === editingCopiIdx ? { ...copiEditForm } : c));
    const res = await apiUpdateProject(project.id, { co_pis: updated });
    if (res.success) { setCoPIs(updated); setEditingCopiIdx(null); toast.success('Co-PI updated.'); }
  };

  // Documents management (backend has no update endpoint -> edit = delete + re-upload)
  const emptyDocForm = { name: '', type: '', file: null, fileName: '', currentLabel: '' };
  const [documents, setDocuments] = useState([]);
  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDocIdx, setEditingDocIdx] = useState(null);
  const [docForm, setDocForm] = useState(emptyDocForm);
  const docFileRef = useRef(null);
  const openAddDoc = () => { setEditingDocIdx(null); setDocForm(emptyDocForm); setShowDocModal(true); };
  const openEditDoc = (i) => {
    const d = documents[i];
    setEditingDocIdx(i);
    setDocForm({
      name: d.name || '', type: d.type || '', file: null, fileName: '',
      currentLabel: d.file_path ? `Current file attached (${d.type || 'file'})` : (d.link ? 'Current: linked document' : ''),
    });
    setShowDocModal(true);
  };
  const handleDocFileSelect = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const ext = file.name.includes('.') ? file.name.split('.').pop().toUpperCase() : 'FILE';
    setDocForm(prev => ({ ...prev, file, fileName: file.name, type: ext, name: prev.name.trim() ? prev.name : file.name.replace(/\.[^.]+$/, '') }));
    e.target.value = '';
  };
  const saveDoc = async () => {
    if (!docForm.name.trim()) { toast.error('Please enter a document name.'); return; }
    if (editingDocIdx === null && !docForm.file) { toast.error('Please select a file.'); return; }
    const fd = new FormData();
    fd.append('name', docForm.name.trim());
    if (docForm.file) fd.append('file', docForm.file);
    await whileSaving(async () => {
      const res = editingDocIdx !== null
        ? await apiUpdateDocument(project.id, documents[editingDocIdx].id, fd)
        : await apiAddDocument(project.id, fd);
      if (res.success) {
        const doc = mapDocument((res.response && res.response.document) || res.response);
        setDocuments(prev => (editingDocIdx !== null ? prev.map((d, i) => (i === editingDocIdx ? doc : d)) : [...prev, doc]));
        setShowDocModal(false);
        toast.success(editingDocIdx !== null ? 'Document updated.' : 'Document uploaded.');
      }
    });
  };
  const removeDoc = async (i) => {
    const d = documents[i];
    if (!window.confirm(`Delete "${d.name || 'this document'}"? This cannot be undone.`)) return;
    const res = await apiDeleteDocument(project.id, d.id);
    if (res.success) { setDocuments(prev => prev.filter((_, idx) => idx !== i)); toast.success('Document deleted.'); }
  };

  // Sanction letter (file or link)
  const [sanctionDoc, setSanctionDoc] = useState(null);
  const sanctionInputRef = useRef(null);
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [sanctionMode, setSanctionMode] = useState('file');
  const [sanctionLinkInput, setSanctionLinkInput] = useState('');
  const [sanctionFileSel, setSanctionFileSel] = useState(null);
  const openSanctionModal = () => {
    const isLink = !!(sanctionDoc && sanctionDoc.isLink);
    setSanctionMode(isLink ? 'link' : 'file');
    setSanctionLinkInput(isLink ? sanctionDoc.url : '');
    setSanctionFileSel(null);
    setShowSanctionModal(true);
  };
  const handleSanctionFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSanctionFileSel({ name: file.name, file });
    e.target.value = '';
  };
  const saveSanctionModal = async () => {
    if (sanctionMode === 'file') {
      if (!sanctionFileSel || !sanctionFileSel.file) { toast.error('Please select a file.'); return; }
      const fd = new FormData();
      fd.append('sanction_letter', sanctionFileSel.file);
      await whileSaving(async () => {
        const res = await apiUpdateProject(project.id, fd, true);
        if (res.success) {
          const { project: p } = await apiGetProject(id);
          if (p) setSanctionDoc(sanctionFromProject(p));
          setShowSanctionModal(false);
          toast.success('Sanction letter updated.');
        }
      });
    } else {
      if (!sanctionLinkInput.trim()) { toast.error('Please enter a link.'); return; }
      await whileSaving(async () => {
        const res = await apiUpdateProject(project.id, { sanction_letter_link: sanctionLinkInput.trim(), sanction_letter_name: 'Sanction Letter' });
        if (res.success) {
          setSanctionDoc({ name: 'Sanction Letter', url: sanctionLinkInput.trim(), isLink: true });
          setShowSanctionModal(false);
          toast.success('Sanction letter updated.');
        }
      });
    }
  };

  const ganttInputRef = useRef(null);
  const [ganttUploaded, flashGanttUploaded] = useDoneFlash();
  const uploadGantt = async (e) => {
    const file = e.target.files[0];
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    const res = await apiUploadGanttChart(project.id, file);
    if (res.success) { toast.success('Gantt chart uploaded.'); flashGanttUploaded(); refreshProject(); }
  };

  // Sync all sub-states from a loaded project.
  const applyProject = (p) => {
    setProject(p);
    setMilestones(p.milestones || []);
    setBudgetData(p.budget || {});
    setCoPIs(p.coPIs || []);
    setDocuments(p.documents || []);
    setSanctionDoc(sanctionFromProject(p));
  };
  const refreshProject = async () => {
    const { project: p } = await apiGetProject(id);
    if (p) applyProject(p);
  };

  useEffect(() => {
    let cancelled = false;
    // Another project starts clean: the last one's data and half-made edits
    // would otherwise show, and save, under this id.
    setLoading(true);
    setLoadFailed(false);
    setProject(null);
    setEditingIdx(null);
    setShowAddForm(false);
    setEditingCopiIdx(null);
    setShowCopiForm(false);
    setShowDocModal(false);
    setShowSanctionModal(false);
    apiGetProject(id).then(({ project: p, failed }) => {
      if (cancelled) return;
      if (p) applyProject(p);
      setLoadFailed(failed);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadAttempt]);

  if (loading) {
    return <StatusNotice tone="loading" title="Loading project" />;
  }
  if (loadFailed) {
    return <LoadError message="Could not load this project. Check your connection and try again." onRetry={() => setLoadAttempt((n) => n + 1)} />;
  }
  if (!project) {
    return (
      <StatusNotice
        tone="empty"
        title="Project not found."
        action={<CustomButton text="Go back" variant="quiet" onClick={() => navigate('/projects')} />}
      />
    );
  }

  // A HOD or coordinator reads every project in their department but writes
  // only their own, so every write control below is behind this.
  const canEdit = project.canEdit;

  const openPositions = (project.positions || []).filter((p) => p.status === 'Open');

  const progress = getMilestoneProgress(milestones);
  const completedMilestones = milestones.filter(m => m.status === 'Completed').length;
  // The badge beside each milestone names the status; the icon only helps the
  // eye run down the timeline.
  const msIcons = { Completed: 'fa-check', 'In Progress': 'fa-hourglass-half', 'Not Started': 'fa-circle-o', Delayed: 'fa-exclamation' };

  const required = <span className="req" aria-hidden="true">*</span>;

  const renderTab = () => {
    switch (activeTab) {
      case 'Overview': return (
        <div className="panel-columns" role="tabpanel">
          <div className="panel-stack">
            <Panel title="Project objectives">
              {(project.objectives || []).length === 0 ? (
                <StatusNotice tone="empty" title="No objectives recorded." />
              ) : (
                <ol className="pd-obj-list">
                  {project.objectives.map((obj, i) => (
                    <li key={i}>{typeof obj === 'string' ? obj : [obj.title, obj.description].filter(Boolean).join(': ')}</li>
                  ))}
                </ol>
              )}
            </Panel>
            <Panel title="Detailed description">
              <p className="pd-description">{project.description || 'No description added.'}</p>
            </Panel>
          </div>
          <div className="panel-stack">
            <Panel title="Project metadata">
              <dl className="kv">
                <div><dt>Primary category</dt><dd>{project.category}</dd></div>
                <div><dt>Focus area</dt><dd>{project.focusArea || EMPTY_VALUE}</dd></div>
                <div><dt>Grant type</dt><dd>{project.grantType || EMPTY_VALUE}</dd></div>
                <div><dt>Project status</dt><dd><span className={badgeClass(project.status)}>{project.status}</span></dd></div>
              </dl>
            </Panel>
            <Panel title="Sustainable development goals">
              {(project.sdgs || []).length === 0 ? (
                <p className="pd-muted">None selected</p>
              ) : (
                <div className="pd-sdg-badges">
                  {project.sdgs.map(id => {
                    const g = (meta.sdgs || []).find(s => s.id === id);
                    return g ? <span key={id} className="badge badge--accent" title={`SDG ${g.id}`}>{g.id}. {g.label}</span> : null;
                  })}
                </div>
              )}
            </Panel>
          </div>
        </div>
      );

      case 'Milestones': return (
        <div className="pd-tab-panel" role="tabpanel">
          <Panel
            title="Gantt chart"
            actions={canEdit && (
              <>
                <CustomButton
                  text={project.ganttChartName ? 'Replace Gantt chart' : 'Upload Gantt chart'}
                  variant="secondary"
                  size="sm"
                  done={ganttUploaded}
                  onClick={() => ganttInputRef.current && ganttInputRef.current.click()}
                />
                <input type="file" ref={ganttInputRef} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx" style={{ display: 'none' }} onChange={uploadGantt} />
              </>
            )}
          >
            {project.ganttChartUrl ? (
              <a className="pd-doc-link" href={project.ganttChartUrl} target="_blank" rel="noreferrer">
                <i className="fa fa-file-o" aria-hidden="true"></i> {project.ganttChartName || 'Gantt chart'}
              </a>
            ) : (
              <p className="pd-muted">No Gantt chart uploaded yet.</p>
            )}
          </Panel>
          <Panel
            title="Project milestones"
            actions={<>
              <div className="pd-ms-progress">
                <span className="pd-ms-pct">{progress}%</span>
                <div className="pd-progress-track" aria-hidden="true"><div className="pd-progress-fill" style={{ width: `${progress}%` }}></div></div>
              </div>
              {canEdit && (
                <CustomButton text="Add milestone" variant="secondary" size="sm" onClick={() => setShowAddForm(!showAddForm)} />
              )}
            </>}
          >
            {showAddForm && (
              <PanelSection title="New milestone">
                <div className="pd-ms-form-grid">
                  <div className="pd-ms-field"><label htmlFor="project-details-milestone-name">Milestone name {required}</label><input id="project-details-milestone-name" type="text" aria-required="true" value={newMs.name} onChange={e => setNewMs({...newMs, name: e.target.value})} placeholder="e.g. Prototype Delivery" /></div>
                  <div className="pd-ms-field"><label htmlFor="project-details-deliverable">Deliverable {required}</label><input id="project-details-deliverable" type="text" aria-required="true" value={newMs.deliverable} onChange={e => setNewMs({...newMs, deliverable: e.target.value})} placeholder="e.g. Working demo" /></div>
                  <div className="pd-ms-field"><label htmlFor="project-details-due-date">Due date {required}</label><input id="project-details-due-date" type="date" aria-required="true" value={newMs.dueDate} onChange={e => setNewMs({...newMs, dueDate: e.target.value})} /></div>
                  <div className="pd-ms-field"><label htmlFor="project-details-status">Status</label>
                    <select id="project-details-status" value={newMs.status} onChange={e => setNewMs({...newMs, status: e.target.value})}>
                      {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pd-form-actions">
                  <CustomButton text="Add" variant="secondary" size="sm" onClick={addMilestone} disabled={saving} />
                  <CustomButton text="Cancel" variant="quiet" size="sm" onClick={() => setShowAddForm(false)} />
                </div>
              </PanelSection>
            )}

            <div className={showAddForm ? 'panel-section' : undefined}>
              <div className="pd-timeline">
                {milestones.map((m, i) => (
                  <div key={i} className={`pd-tl-item ${m.status.toLowerCase().replace(' ', '-')}`}>
                    <div className="pd-tl-icon" aria-hidden="true"><i className={`fa ${msIcons[m.status] || 'fa-circle-o'}`}></i></div>
                    <div className="pd-tl-content">
                      {editingIdx === i ? (
                        <div>
                          <div className="pd-ms-form-grid">
                            <div className="pd-ms-field"><label htmlFor="project-details-name">Name {required}</label><input id="project-details-name" type="text" aria-required="true" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                            <div className="pd-ms-field"><label htmlFor="project-details-deliverable-2">Deliverable {required}</label><input id="project-details-deliverable-2" type="text" aria-required="true" value={editForm.deliverable} onChange={e => setEditForm({...editForm, deliverable: e.target.value})} /></div>
                            <div className="pd-ms-field"><label htmlFor="project-details-due-date-2">Due date {required}</label><input id="project-details-due-date-2" type="date" aria-required="true" value={editForm.dueDate} onChange={e => setEditForm({...editForm, dueDate: e.target.value})} /></div>
                            <div className="pd-ms-field"><label htmlFor="project-details-status-2">Status</label>
                              <select id="project-details-status-2" value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                                {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </div>
                          </div>
                          <div className="pd-form-actions">
                            <CustomButton text="Save" variant="secondary" size="sm" onClick={saveEdit} />
                            <CustomButton text="Cancel" variant="quiet" size="sm" onClick={cancelEdit} />
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="pd-tl-top">
                            <h3 className="pd-tl-name">{m.name}</h3>
                            <div className="pd-tl-actions">
                              <span className={badgeClass(m.status)}>{m.status}</span>
                              {canEdit && <button type="button" className="pd-icon-btn" onClick={() => startEdit(i)} title="Edit milestone" aria-label="Edit milestone"><i className="fa fa-pencil" aria-hidden="true"></i></button>}
                            </div>
                          </div>
                          <p className="pd-tl-deliverable">{m.deliverable}</p>
                          <span className="pd-tl-date"><i className="fa fa-calendar" aria-hidden="true"></i> Due: {formatDate(m.dueDate)}</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      );

      case 'Project team': return (
        <div className="pd-tab-panel" role="tabpanel">
          <Panel title="Principal investigator">
            {project.pi ? (
              <div className="pd-team-row">
                <div className="pd-team-avatar" aria-hidden="true">{project.pi.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                <div className="pd-team-info">
                  <p className="pd-team-name"><FacultyLink code={project.pi.code} name={project.pi.name} /></p>
                  <p className="pd-team-dept">{project.pi.department}</p>
                  <p className="pd-team-meta">{project.pi.designation}</p>
                </div>
                <span className="badge badge--accent pd-team-role">PI</span>
              </div>
            ) : (
              <StatusNotice tone="empty" title="No principal investigator on record for this project." />
            )}
          </Panel>
          <Panel
            title="Co-PIs"
            actions={canEdit && (
              <CustomButton text="Add Co-PI" variant="secondary" size="sm" onClick={() => setShowCopiForm(!showCopiForm)} />
            )}
          >
            {showCopiForm && (
              <PanelSection title="New Co-PI">
                <div className="pd-ms-form-grid">
                  <div className="pd-ms-field"><label htmlFor="project-details-type">Type</label>
                    <select id="project-details-type" value={newCopi.type} onChange={e => setNewCopi({ ...emptyCopi, type: e.target.value })}>
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                  {newCopi.type === 'internal' ? (
                    <div className="pd-ms-field">
                      <InputSuggestions
                        apiUrl={`${baseURL}/suggestions/faculty`}
                        label="Faculty"
                        required
                        hint="Type faculty name, code or email..."
                        fields={['name', 'department']}
                        onSelect={pickInternal(setNewCopi)}
                      />
                    </div>
                  ) : (
                    <div className="pd-ms-field"><label htmlFor="project-details-full-name">Full name {required}</label><input id="project-details-full-name" type="text" aria-required="true" value={newCopi.name} onChange={e => setNewCopi({ ...newCopi, name: e.target.value })} placeholder="e.g. Dr. Robert Chen" /></div>
                  )}
                  <div className="pd-ms-field input-field-container"><label htmlFor="project-details-institute">{newCopi.type === 'internal' ? 'Department' : 'Institute'}</label>
                    <input id="project-details-institute"
                      type="text"
                      readOnly={newCopi.type === 'internal'}
                      className={newCopi.type === 'internal' ? 'field-readonly' : undefined}
                      value={newCopi.type === 'internal' ? newCopi.department : newCopi.institute}
                      onChange={e => setNewCopi(newCopi.type === 'internal' ? { ...newCopi, department: e.target.value } : { ...newCopi, institute: e.target.value })}
                      placeholder={newCopi.type === 'internal' ? 'Filled from the selected faculty' : 'e.g. MIT CSAIL'}
                    />
                  </div>
                  <div className="pd-ms-field input-field-container"><label htmlFor="project-details-designation">Designation</label><input id="project-details-designation" type="text" readOnly={newCopi.type === 'internal'} className={newCopi.type === 'internal' ? 'field-readonly' : undefined} value={newCopi.designation} onChange={e => setNewCopi({ ...newCopi, designation: e.target.value })} placeholder="e.g. Professor" /></div>
                </div>
                <div className="pd-form-actions">
                  <CustomButton text="Add Co-PI" variant="secondary" size="sm" onClick={addCopi} />
                  <CustomButton text="Cancel" variant="quiet" size="sm" onClick={() => { setShowCopiForm(false); setNewCopi(emptyCopi); }} />
                </div>
              </PanelSection>
            )}

            <div className={showCopiForm ? 'panel-section' : undefined}>
              {coPIs.length > 0 ? coPIs.map((c, i) => (
                editingCopiIdx === i ? (
                  <div key={i} className="pd-team-edit">
                    <h3 className="panel-section-title pd-team-edit-title">Edit Co-PI</h3>
                    <div className="pd-ms-form-grid">
                      <div className="pd-ms-field"><label htmlFor="project-details-type-2">Type</label>
                        <select id="project-details-type-2" value={copiEditForm.type} onChange={e => setCopiEditForm({ ...emptyCopi, type: e.target.value })}>
                          <option value="internal">Internal</option>
                          <option value="external">External</option>
                        </select>
                      </div>
                      {copiEditForm.type === 'internal' ? (
                        <div className="pd-ms-field">
                          <InputSuggestions
                            apiUrl={`${baseURL}/suggestions/faculty`}
                            label="Faculty"
                            required
                            hint="Type faculty name, code or email..."
                            initialValue={copiEditForm.name}
                            fields={['name', 'department']}
                            onSelect={pickInternal(setCopiEditForm)}
                          />
                        </div>
                      ) : (
                        <div className="pd-ms-field"><label htmlFor="project-details-full-name-2">Full name {required}</label><input id="project-details-full-name-2" type="text" aria-required="true" value={copiEditForm.name} onChange={e => setCopiEditForm({ ...copiEditForm, name: e.target.value })} /></div>
                      )}
                      <div className="pd-ms-field input-field-container"><label htmlFor="project-details-institute-2">{copiEditForm.type === 'internal' ? 'Department' : 'Institute'}</label>
                        <input id="project-details-institute-2"
                          type="text"
                          readOnly={copiEditForm.type === 'internal'}
                          className={copiEditForm.type === 'internal' ? 'field-readonly' : undefined}
                          value={copiEditForm.type === 'internal' ? (copiEditForm.department || '') : (copiEditForm.institute || '')}
                          onChange={e => setCopiEditForm(copiEditForm.type === 'internal' ? { ...copiEditForm, department: e.target.value } : { ...copiEditForm, institute: e.target.value })}
                        />
                      </div>
                      <div className="pd-ms-field input-field-container"><label htmlFor="project-details-designation-2">Designation</label><input id="project-details-designation-2" type="text" readOnly={copiEditForm.type === 'internal'} className={copiEditForm.type === 'internal' ? 'field-readonly' : undefined} value={copiEditForm.designation || ''} onChange={e => setCopiEditForm({ ...copiEditForm, designation: e.target.value })} /></div>
                    </div>
                    <div className="pd-form-actions">
                      <CustomButton text="Save" variant="secondary" size="sm" onClick={saveCopiEdit} />
                      <CustomButton text="Cancel" variant="quiet" size="sm" onClick={cancelCopiEdit} />
                    </div>
                  </div>
                ) : (
                  <div key={i} className="pd-team-row">
                    <div className="pd-team-avatar co" aria-hidden="true">{c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                    <div className="pd-team-info">
                      <p className="pd-team-name"><FacultyLink code={c.faculty_code} name={c.name} /></p>
                      <p className="pd-team-dept">{c.type === 'internal' ? c.department : c.institute}</p>
                      <p className="pd-team-meta">{c.designation}</p>
                    </div>
                    <span className={`badge ${c.type === 'internal' ? 'badge--info' : 'badge--purple'} pd-team-role`}>{c.type === 'internal' ? 'Internal' : 'External'}</span>
                    {canEdit && (
                      <>
                        <button type="button" className="pd-icon-btn" onClick={() => startCopiEdit(i)} title="Edit Co-PI" aria-label="Edit Co-PI"><i className="fa fa-pencil" aria-hidden="true"></i></button>
                        <button type="button" className="pd-icon-btn danger" onClick={() => removeCopi(i)} title="Remove Co-PI" aria-label="Remove Co-PI"><i className="fa fa-trash" aria-hidden="true"></i></button>
                      </>
                    )}
                  </div>
                )
              )) : (
                <StatusNotice tone="empty" title="No Co-PIs added yet." />
              )}
            </div>
          </Panel>
        </div>
      );

      case 'Documents': return (
        <div className="pd-tab-panel" role="tabpanel">
          <Panel
            title="Project documents"
            actions={canEdit && <CustomButton text="Add document" variant="secondary" size="sm" onClick={openAddDoc} />}
          >
            {documents.length > 0 ? (
              <ul className="pd-doc-list">
                {documents.map((d, i) => (
                  <li key={i} className="pd-doc-item">
                    <i className="fa fa-file-pdf-o pd-doc-icon" aria-hidden="true"></i>
                    <div className="pd-doc-info"><strong>{d.name}</strong><span>{d.type} &middot; {formatDate(d.date)}</span></div>
                    <div className="pd-doc-actions">
                      {d.url && <a className="pd-icon-btn" href={d.url} target="_blank" rel="noopener noreferrer" title="View document" aria-label="View document"><i className="fa fa-eye" aria-hidden="true"></i></a>}
                      {canEdit && (
                        <>
                          <button type="button" className="pd-icon-btn" onClick={() => openEditDoc(i)} title="Edit document" aria-label="Edit document"><i className="fa fa-pencil" aria-hidden="true"></i></button>
                          <button type="button" className="pd-icon-btn danger" onClick={() => removeDoc(i)} title="Delete document" aria-label="Delete document"><i className="fa fa-trash" aria-hidden="true"></i></button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <StatusNotice tone="empty" title="No documents uploaded yet." />
            )}
          </Panel>
        </div>
      );

      default: return null;
    }
  };

  return (
    <>
      <button type="button" className="page-back-link pd-back" onClick={() => navigate('/projects')}>
        <i className="fa fa-arrow-left" aria-hidden="true"></i> Back to projects
      </button>
      <Page
        className="reveal"
        title={project.title}
        meta={<>
          <span className={badgeClass(project.category)}>{project.category}</span>
          <span className={badgeClass(project.status)}>{project.status}</span>
        </>}
        actions={canEdit && <>
          <CustomButton text="Edit project" variant="secondary" onClick={() => navigate('/projects/create', { state: { editProject: project } })} />
          {features.job_openings && (
            <CustomButton text={openPositions.length ? 'Manage recruitment' : 'Post an opening'} onClick={() => navigate(`/projects/${id}/recruit`)} />
          )}
        </>}
        tabs={<Tabs items={TABS} value={activeTab} onChange={setActiveTab} label="Project sections" />}
      >
        <Panel>
          <dl className="facts">
            <div><dt>Funding agency</dt><dd>{project.fundingAgency || EMPTY_VALUE}</dd></div>
            <div><dt>Sanctioned amount</dt><dd>₹ {Number(project.amount || 0).toLocaleString('en-IN')}</dd></div>
            <div>
              <dt>Duration</dt>
              <dd>
                {formatDuration(project.durationYears, project.durationMonths)}
                {project.startDate ? ` · ${formatDate(project.startDate)} to ${formatDate(project.endDate)}` : ''}
              </dd>
            </div>
            <div>
              <dt>Current progress</dt>
              <dd>{progress}%</dd>
              <dd className="pd-progress-track" aria-hidden="true"><div className="pd-progress-fill" style={{ width: `${progress}%` }}></div></dd>
              {milestones.length > 0 && (
                <dd className="pd-progress-note">{completedMilestones} of {milestones.length} milestones completed</dd>
              )}
            </div>
          </dl>
        </Panel>

        {renderTab()}
        {/* Hidden rather than unmounted with the other tabs, so an unsaved budget
            edit survives a look at another tab. Keyed so another project does
            not inherit an open draft. */}
        <div className="pd-tab-panel" role="tabpanel" hidden={activeTab !== 'Funding and budget'}>
          <Panel title="Funding summary">
            <dl className="facts">
              <div><dt>Total sanctioned</dt><dd>{formatCurrency(project.amount)}</dd></div>
              <div><dt>TIET share</dt><dd>{project.tietShare == null ? EMPTY_VALUE : formatCurrency(project.tietShare)}</dd></div>
              <div>
                <dt>Sanction letter</dt>
                <dd className="pd-sanction-view">
                  {sanctionDoc ? (
                    <a href={sanctionDoc.url} target="_blank" rel="noopener noreferrer"><i className={`fa ${sanctionDoc.isLink ? 'fa-link' : 'fa-file-pdf-o'}`} aria-hidden="true"></i> {sanctionDoc.name}</a>
                  ) : (
                    <span className="pd-muted">Not uploaded</span>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      className="pd-icon-btn"
                      onClick={openSanctionModal}
                      title={sanctionDoc ? 'Edit sanction letter' : 'Add sanction letter'}
                      aria-label={sanctionDoc ? 'Edit sanction letter' : 'Add sanction letter'}
                    >
                      <i className={`fa ${sanctionDoc ? 'fa-pencil' : 'fa-plus'}`} aria-hidden="true"></i>
                    </button>
                  )}
                </dd>
              </div>
            </dl>
          </Panel>
          <ProjectBudgetCard key={project.id} projectId={project.id} budget={budgetData} meta={meta} canEdit={canEdit} onSaved={setBudgetData} />
        </div>

        {/* Add / Edit Document Modal */}
        <CustomModal
          isOpen={showDocModal}
          onClose={() => setShowDocModal(false)}
          title={editingDocIdx !== null ? 'Edit document' : 'Add document'}
          maxWidth="520px"
          minHeight="auto"
        >
          <>
            <div className="pd-modal-field">
              <label htmlFor="project-details-document-name">Document name {required}</label>
              <input id="project-details-document-name"
                type="text"
                aria-required="true"
                value={docForm.name}
                onChange={e => setDocForm({ ...docForm, name: e.target.value })}
                placeholder="e.g. Year 1 Progress Report"
              />
            </div>
            <div className="pd-modal-field">
              <label htmlFor="project-details-document-file">{editingDocIdx !== null ? 'Replace document' : 'Upload document'} {editingDocIdx !== null && <span className="pd-modal-hint">(optional: leave empty to keep the current file)</span>}</label>
              {editingDocIdx !== null && docForm.currentLabel && !docForm.fileName && (
                <span className="pd-upload-current"><i className="fa fa-paperclip" aria-hidden="true"></i> {docForm.currentLabel}</span>
              )}
              <button type="button" className="pd-upload-label" onClick={() => docFileRef.current && docFileRef.current.click()}>
                <i className="fa fa-upload" aria-hidden="true"></i> {editingDocIdx !== null ? 'Replace file' : 'Select file from system'}
              </button>
              <input
                id="project-details-document-file"
                type="file"
                ref={docFileRef}
                style={{ display: 'none' }}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                onChange={handleDocFileSelect}
              />
              {docForm.fileName && <span className="pd-upload-selected"><i className="fa fa-paperclip" aria-hidden="true"></i> {docForm.fileName}</span>}
            </div>
            <div className="modal-actions">
              <CustomButton text="Cancel" variant="quiet" onClick={() => setShowDocModal(false)} />
              <CustomButton text={editingDocIdx !== null ? 'Save changes' : 'Add document'} onClick={saveDoc} busy={saving} />
            </div>
          </>
        </CustomModal>

        {/* Sanction Letter Modal (file or link) */}
        <CustomModal
          isOpen={showSanctionModal}
          onClose={() => setShowSanctionModal(false)}
          title="Sanction letter"
          maxWidth="520px"
          minHeight="auto"
        >
          <>
            <Tabs
              items={[{ value: 'file', label: 'Choose file' }, { value: 'link', label: 'Paste link' }]}
              value={sanctionMode}
              onChange={setSanctionMode}
              label="Sanction letter source"
            />
            {sanctionMode === 'file' ? (
              <div className="pd-modal-field">
                <label htmlFor="project-details-choose-file">Choose file</label>
                <button type="button" className="pd-upload-label" onClick={() => sanctionInputRef.current && sanctionInputRef.current.click()}>
                  <i className="fa fa-upload" aria-hidden="true"></i> {sanctionFileSel ? 'Change file' : 'Select file from system'}
                </button>
                <input
                  id="project-details-choose-file"
                  type="file"
                  ref={sanctionInputRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={handleSanctionFile}
                />
                {sanctionFileSel && <span className="pd-upload-selected"><i className="fa fa-paperclip" aria-hidden="true"></i> {sanctionFileSel.name}</span>}
              </div>
            ) : (
              <div className="pd-modal-field">
                <label htmlFor="project-details-document-link">Document link</label>
                <input id="project-details-document-link" type="url" value={sanctionLinkInput} onChange={e => setSanctionLinkInput(e.target.value)} placeholder="https://… link to sanction letter" />
              </div>
            )}
            <div className="modal-actions">
              <CustomButton text="Cancel" variant="quiet" onClick={() => setShowSanctionModal(false)} />
              <CustomButton text="Save" onClick={saveSanctionModal} busy={saving} />
            </div>
          </>
        </CustomModal>
      </Page>
    </>
  );
};

export default ProjectDetails;
