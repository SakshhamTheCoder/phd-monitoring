import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/timeParse';
import { apiUpdateProject, apiAddMilestone, apiUpdateMilestone, apiAddDocument, apiUpdateDocument, apiDeleteDocument, apiUploadGanttChart } from '../../api/projects';
import { useView } from '../../api/views';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import CustomModal from '../../components/forms/modal/CustomModal';
import Tabs from '../../components/tabs/Tabs';
import CustomButton from '../../components/forms/fields/CustomButton';
import FacultyLink from '../../components/facultyLink/FacultyLink';
import { baseURL } from '../../api/urls';
import { storedFileUrl, storedFileClick } from '../../api/fileAccess';
import { toast } from 'react-toastify';
import ProjectBudgetCard from './ProjectBudgetCard';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel, { PanelSection } from '../../components/panel/Panel';
import './ProjectDetails.css';
import useDoneFlash from '../../hooks/useDoneFlash';

const Badge = ({ badge, className = '' }) => <span className={`badge badge--${badge.tone}${className}`}>{badge.text}</span>;
// A value the server phrased, drawn as the runs of text it sent (a list is
// one run), its dates printed on the reader's calendar.
const piece = (part) => (typeof part === 'string' ? part : formatDate(part.date));
const phrased = (parts) => parts.map((part, index) => (
  <React.Fragment key={index}>{Array.isArray(part) ? part.map(piece).join('') : piece(part)}</React.Fragment>
));
const initials = (name) => name.split(' ').map((n) => n[0]).join('').slice(0, 2);
const blankMilestone = { name: '', deliverable: '', dueDate: '', status: 'Not Started' };
const emptyCopi = { name: '', type: 'internal', faculty_code: null, department: '', institute: '', designation: '' };
const emptyDocForm = { name: '', type: '', file: null, fileName: '', currentLabel: '' };

/**
 * One project (GET /views/project, server: App\Pages\ProjectPage): every
 * figure, badge and permission on it is the server's. The changes it offers
 * go to the project endpoints, and the page is read again after each.
 */
const Project = ({ view, reload }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(view.tabs[0]);
  // One flag for the add and upload saves below: a second click while the
  // first was on its way posted a second milestone or document.
  const [saving, setSaving] = useState(false);
  const whileSaving = async (task) => {
    if (saving) return;
    setSaving(true);
    try { await task(); } finally { setSaving(false); }
  };
  const milestones = view.milestones;
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState(blankMilestone);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMs, setNewMs] = useState(blankMilestone);
  // The budget card's last save shows until the page is read again.
  const [budgetData, setBudgetData] = useState(view.funding.budget);
  useEffect(() => { setBudgetData(view.funding.budget); }, [view]);

  const validateMilestone = (m) => {
    const missing = view.milestone_checks.find((check) => !String(m[check.key] ?? '').trim());
    if (missing) toast.error(missing.message);
    return !missing;
  };
  const startEdit = (i) => { setEditingIdx(i); setEditForm({ ...blankMilestone, ...milestones[i], dueDate: milestones[i].due }); };
  const cancelEdit = () => { setEditingIdx(null); };
  const saveEdit = async () => {
    if (!validateMilestone(editForm)) return;
    const res = await apiUpdateMilestone(view.id, milestones[editingIdx].id, editForm);
    if (res.success) {
      setEditingIdx(null);
      toast.success('Milestone updated.');
      reload();
    }
  };
  const addMilestone = async () => {
    if (!validateMilestone(newMs)) return;
    await whileSaving(async () => {
      const res = await apiAddMilestone(view.id, newMs);
      if (res.success) {
        setNewMs(blankMilestone);
        setShowAddForm(false);
        toast.success('Milestone added.');
        reload();
      }
    });
  };

  const pickInternal = (setter) => (fac) => {
    if (!fac || !fac.id) return;
    setter((prev) => ({
      ...prev, type: 'internal', faculty_code: fac.id,
      name: fac.name, department: fac.department, designation: fac.designation,
    }));
  };
  const coPIs = view.co_pis;
  const [showCopiForm, setShowCopiForm] = useState(false);
  const [newCopi, setNewCopi] = useState(emptyCopi);
  const invalidCopi = (c) => {
    if (c.type === 'internal' && !c.faculty_code) { toast.error('Pick a faculty member from the suggestions.'); return true; }
    if (!c.name.trim()) { toast.error('A name is required.'); return true; }
    return false;
  };
  const saveCopis = async (updated, done) => {
    const res = await apiUpdateProject(view.id, { co_pis: updated });
    if (res.success) { done(); reload(); }
  };
  const addCopi = async () => {
    if (invalidCopi(newCopi)) return;
    await saveCopis([...coPIs, { ...newCopi }], () => { setNewCopi(emptyCopi); setShowCopiForm(false); toast.success('Co-PI added.'); });
  };
  const removeCopi = async (i) => {
    if (!window.confirm('Are you sure you want to remove this Co-PI?')) return;
    await saveCopis(coPIs.filter((_, idx) => idx !== i), () => toast.success('Co-PI removed.'));
  };
  const [editingCopiIdx, setEditingCopiIdx] = useState(null);
  const [copiEditForm, setCopiEditForm] = useState(emptyCopi);
  const startCopiEdit = (i) => { setEditingCopiIdx(i); setCopiEditForm({ ...emptyCopi, ...coPIs[i] }); };
  const cancelCopiEdit = () => setEditingCopiIdx(null);
  const saveCopiEdit = async () => {
    if (invalidCopi(copiEditForm)) return;
    await saveCopis(coPIs.map((c, idx) => (idx === editingCopiIdx ? { ...copiEditForm } : c)), () => { setEditingCopiIdx(null); toast.success('Co-PI updated.'); });
  };

  // Documents: an edit replaces the file or keeps it.
  const documents = view.documents;
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
    setDocForm((prev) => ({ ...prev, file, fileName: file.name, type: ext, name: prev.name.trim() ? prev.name : file.name.replace(/\.[^.]+$/, '') }));
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
        ? await apiUpdateDocument(view.id, documents[editingDocIdx].id, fd)
        : await apiAddDocument(view.id, fd);
      if (res.success) {
        setShowDocModal(false);
        toast.success(editingDocIdx !== null ? 'Document updated.' : 'Document uploaded.');
        reload();
      }
    });
  };
  const removeDoc = async (i) => {
    const d = documents[i];
    if (!window.confirm(`Delete "${d.name || 'this document'}"? This cannot be undone.`)) return;
    const res = await apiDeleteDocument(view.id, d.id);
    if (res.success) { toast.success('Document deleted.'); reload(); }
  };

  // Sanction letter (file or link)
  const sanctionDoc = view.funding.sanction;
  const sanctionInputRef = useRef(null);
  const [showSanctionModal, setShowSanctionModal] = useState(false);
  const [sanctionMode, setSanctionMode] = useState('file');
  const [sanctionLinkInput, setSanctionLinkInput] = useState('');
  const [sanctionFileSel, setSanctionFileSel] = useState(null);
  const openSanctionModal = () => {
    const isLink = !!(sanctionDoc && sanctionDoc.is_link);
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
    let body;
    if (sanctionMode === 'file') {
      if (!sanctionFileSel || !sanctionFileSel.file) { toast.error('Please select a file.'); return; }
      body = new FormData();
      body.append('sanction_letter', sanctionFileSel.file);
    } else {
      if (!sanctionLinkInput.trim()) { toast.error('Please enter a link.'); return; }
      body = { sanction_letter_link: sanctionLinkInput.trim(), sanction_letter_name: 'Sanction Letter' };
    }
    await whileSaving(async () => {
      const res = await apiUpdateProject(view.id, body, sanctionMode === 'file');
      if (res.success) {
        setShowSanctionModal(false);
        toast.success('Sanction letter updated.');
        reload();
      }
    });
  };

  const ganttInputRef = useRef(null);
  const [ganttUploaded, flashGanttUploaded] = useDoneFlash();
  const uploadGantt = async (e) => {
    const file = e.target.files[0];
    // Cleared so picking the same file again still fires a change.
    e.target.value = '';
    if (!file) return;
    const res = await apiUploadGanttChart(view.id, file);
    if (res.success) { toast.success('Gantt chart uploaded.'); flashGanttUploaded(); reload(); }
  };

  // A HOD or coordinator reads every project in their department but writes
  // only their own, so every write control below is behind this.
  const canEdit = view.can_edit;
  const { progress } = view;
  const required = <span className="req" aria-hidden="true">*</span>;

  const statusOptions = view.options.milestoneStatuses.map((s) => <option key={s} value={s}>{s}</option>);

  const renderTab = () => {
    switch (activeTab) {
      case 'Overview': return (
        <div className="panel-columns" role="tabpanel">
          <div className="panel-stack">
            <Panel title="Project objectives">
              {view.overview.objectives.length === 0 ? (
                <StatusNotice tone="empty" title={view.overview.no_objectives} />
              ) : (
                <ol className="pd-obj-list">
                  {view.overview.objectives.map((obj, i) => <li key={i}>{obj}</li>)}
                </ol>
              )}
            </Panel>
            <Panel title="Detailed description">
              <p className="pd-description">{view.overview.description}</p>
            </Panel>
          </div>
          <div className="panel-stack">
            <Panel title="Project metadata">
              <dl className="kv">
                {view.overview.metadata.map((row) => (
                  <div key={row.label}><dt>{row.label}</dt><dd>{row.badge ? <Badge badge={row.badge} /> : row.value}</dd></div>
                ))}
              </dl>
            </Panel>
            <Panel title="Sustainable development goals">
              {view.overview.sdgs.length === 0 ? (
                <p className="pd-muted">{view.overview.no_sdgs}</p>
              ) : (
                <div className="pd-sdg-badges">
                  {view.overview.sdgs.map((g) => <span key={g.id} className="badge badge--accent" title={`SDG ${g.id}`}>{phrased(g.text)}</span>)}
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
                  text={view.gantt.upload}
                  variant="secondary"
                  size="sm"
                  done={ganttUploaded}
                  onClick={() => ganttInputRef.current && ganttInputRef.current.click()}
                />
                <input type="file" ref={ganttInputRef} accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.doc,.docx" style={{ display: 'none' }} onChange={uploadGantt} />
              </>
            )}
          >
            {view.gantt.path ? (
              <a className="pd-doc-link" href={storedFileUrl(view.gantt.path)} target="_blank" rel="noreferrer" onClick={storedFileClick(view.gantt.path)}>
                <i className="fa fa-file-o" aria-hidden="true"></i> {view.gantt.name}
              </a>
            ) : (
              <p className="pd-muted">{view.gantt.none}</p>
            )}
          </Panel>
          <Panel
            title="Project milestones"
            actions={<>
              <div className="pd-ms-progress">
                <span className="pd-ms-pct">{progress.percent}%</span>
                <div className="pd-progress-track" aria-hidden="true"><div className="pd-progress-fill" style={{ width: `${progress.percent}%` }}></div></div>
              </div>
              {canEdit && (
                <CustomButton text="Add milestone" variant="secondary" size="sm" onClick={() => setShowAddForm(!showAddForm)} />
              )}
            </>}
          >
            {showAddForm && (
              <PanelSection title="New milestone">
                <div className="pd-ms-form-grid">
                  <div className="pd-ms-field"><label htmlFor="project-details-milestone-name">Milestone name {required}</label><input id="project-details-milestone-name" type="text" aria-required="true" value={newMs.name} onChange={(e) => setNewMs({ ...newMs, name: e.target.value })} placeholder="e.g. Prototype Delivery" /></div>
                  <div className="pd-ms-field"><label htmlFor="project-details-deliverable">Deliverable {required}</label><input id="project-details-deliverable" type="text" aria-required="true" value={newMs.deliverable} onChange={(e) => setNewMs({ ...newMs, deliverable: e.target.value })} placeholder="e.g. Working demo" /></div>
                  <div className="pd-ms-field"><label htmlFor="project-details-due-date">Due date {required}</label><input id="project-details-due-date" type="date" aria-required="true" value={newMs.dueDate} onChange={(e) => setNewMs({ ...newMs, dueDate: e.target.value })} /></div>
                  <div className="pd-ms-field"><label htmlFor="project-details-status">Status</label>
                    <select id="project-details-status" value={newMs.status} onChange={(e) => setNewMs({ ...newMs, status: e.target.value })}>
                      {statusOptions}
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
                  <div key={i} className={`pd-tl-item ${m.class}`}>
                    <div className="pd-tl-icon" aria-hidden="true"><i className={`fa ${m.icon}`}></i></div>
                    <div className="pd-tl-content">
                      {editingIdx === i ? (
                        <div>
                          <div className="pd-ms-form-grid">
                            <div className="pd-ms-field"><label htmlFor="project-details-name">Name {required}</label><input id="project-details-name" type="text" aria-required="true" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
                            <div className="pd-ms-field"><label htmlFor="project-details-deliverable-2">Deliverable {required}</label><input id="project-details-deliverable-2" type="text" aria-required="true" value={editForm.deliverable} onChange={(e) => setEditForm({ ...editForm, deliverable: e.target.value })} /></div>
                            <div className="pd-ms-field"><label htmlFor="project-details-due-date-2">Due date {required}</label><input id="project-details-due-date-2" type="date" aria-required="true" value={editForm.dueDate} onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })} /></div>
                            <div className="pd-ms-field"><label htmlFor="project-details-status-2">Status</label>
                              <select id="project-details-status-2" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}>
                                {statusOptions}
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
                              <Badge badge={m.badge} />
                              {canEdit && <button type="button" className="pd-icon-btn" onClick={() => startEdit(i)} title="Edit milestone" aria-label="Edit milestone"><i className="fa fa-pencil" aria-hidden="true"></i></button>}
                            </div>
                          </div>
                          <p className="pd-tl-deliverable">{m.deliverable}</p>
                          <span className="pd-tl-date"><i className="fa fa-calendar" aria-hidden="true"></i> Due: {formatDate(m.due)}</span>
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
            {view.pi ? (
              <div className="pd-team-row">
                <div className="pd-team-avatar" aria-hidden="true">{initials(view.pi.name)}</div>
                <div className="pd-team-info">
                  <p className="pd-team-name"><FacultyLink code={view.pi.code} name={view.pi.name} /></p>
                  <p className="pd-team-dept">{view.pi.department}</p>
                  <p className="pd-team-meta">{view.pi.designation}</p>
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
                    <select id="project-details-type" value={newCopi.type} onChange={(e) => setNewCopi({ ...emptyCopi, type: e.target.value })}>
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
                    <div className="pd-ms-field"><label htmlFor="project-details-full-name">Full name {required}</label><input id="project-details-full-name" type="text" aria-required="true" value={newCopi.name} onChange={(e) => setNewCopi({ ...newCopi, name: e.target.value })} placeholder="e.g. Dr. Robert Chen" /></div>
                  )}
                  <div className="pd-ms-field input-field-container"><label htmlFor="project-details-institute">{newCopi.type === 'internal' ? 'Department' : 'Institute'}</label>
                    <input id="project-details-institute"
                      type="text"
                      readOnly={newCopi.type === 'internal'}
                      className={newCopi.type === 'internal' ? 'field-readonly' : undefined}
                      value={newCopi.type === 'internal' ? newCopi.department : newCopi.institute}
                      onChange={(e) => setNewCopi(newCopi.type === 'internal' ? { ...newCopi, department: e.target.value } : { ...newCopi, institute: e.target.value })}
                      placeholder={newCopi.type === 'internal' ? 'Filled from the selected faculty' : 'e.g. MIT CSAIL'}
                    />
                  </div>
                  <div className="pd-ms-field input-field-container"><label htmlFor="project-details-designation">Designation</label><input id="project-details-designation" type="text" readOnly={newCopi.type === 'internal'} className={newCopi.type === 'internal' ? 'field-readonly' : undefined} value={newCopi.designation} onChange={(e) => setNewCopi({ ...newCopi, designation: e.target.value })} placeholder="e.g. Professor" /></div>
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
                        <select id="project-details-type-2" value={copiEditForm.type} onChange={(e) => setCopiEditForm({ ...emptyCopi, type: e.target.value })}>
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
                        <div className="pd-ms-field"><label htmlFor="project-details-full-name-2">Full name {required}</label><input id="project-details-full-name-2" type="text" aria-required="true" value={copiEditForm.name} onChange={(e) => setCopiEditForm({ ...copiEditForm, name: e.target.value })} /></div>
                      )}
                      <div className="pd-ms-field input-field-container"><label htmlFor="project-details-institute-2">{copiEditForm.type === 'internal' ? 'Department' : 'Institute'}</label>
                        <input id="project-details-institute-2"
                          type="text"
                          readOnly={copiEditForm.type === 'internal'}
                          className={copiEditForm.type === 'internal' ? 'field-readonly' : undefined}
                          value={copiEditForm.type === 'internal' ? (copiEditForm.department || '') : (copiEditForm.institute || '')}
                          onChange={(e) => setCopiEditForm(copiEditForm.type === 'internal' ? { ...copiEditForm, department: e.target.value } : { ...copiEditForm, institute: e.target.value })}
                        />
                      </div>
                      <div className="pd-ms-field input-field-container"><label htmlFor="project-details-designation-2">Designation</label><input id="project-details-designation-2" type="text" readOnly={copiEditForm.type === 'internal'} className={copiEditForm.type === 'internal' ? 'field-readonly' : undefined} value={copiEditForm.designation || ''} onChange={(e) => setCopiEditForm({ ...copiEditForm, designation: e.target.value })} /></div>
                    </div>
                    <div className="pd-form-actions">
                      <CustomButton text="Save" variant="secondary" size="sm" onClick={saveCopiEdit} />
                      <CustomButton text="Cancel" variant="quiet" size="sm" onClick={cancelCopiEdit} />
                    </div>
                  </div>
                ) : (
                  <div key={i} className="pd-team-row">
                    <div className="pd-team-avatar co" aria-hidden="true">{initials(c.name)}</div>
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
                      {d.url && <a className="pd-icon-btn" href={storedFileUrl(d.url)} target="_blank" rel="noopener noreferrer" onClick={storedFileClick(d.url)} title="View document" aria-label="View document"><i className="fa fa-eye" aria-hidden="true"></i></a>}
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

  const runAction = (action) => {
    if (action.edits) navigate('/projects/create', { state: { editProject: { id: action.edits } } });
    else navigate(action.navigate);
  };

  return (
    <>
      <button type="button" className="page-back-link pd-back" onClick={() => navigate('/projects')}>
        <i className="fa fa-arrow-left" aria-hidden="true"></i> {view.back}
      </button>
      <Page
        className={view.page_class}
        title={view.title}
        meta={<>{view.badges.map((badge) => <Badge key={badge.text} badge={badge} />)}</>}
        actions={view.actions.length > 0 && <>
          {view.actions.map((action) => (
            <CustomButton key={action.label} text={action.label} variant={action.variant} onClick={() => runAction(action)} />
          ))}
        </>}
        tabs={<Tabs items={view.tabs} value={activeTab} onChange={setActiveTab} label="Project sections" />}
      >
        <Panel>
          <dl className="facts">
            {view.facts.map((fact) => (
              <div key={fact.label}><dt>{fact.label}</dt><dd>{phrased(fact.value)}</dd></div>
            ))}
            <div>
              <dt>{progress.label}</dt>
              <dd>{progress.percent}%</dd>
              <dd className="pd-progress-track" aria-hidden="true"><div className="pd-progress-fill" style={{ width: `${progress.percent}%` }}></div></dd>
              {progress.note && <dd className="pd-progress-note">{phrased(progress.note)}</dd>}
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
              {view.funding.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
              <div>
                <dt>Sanction letter</dt>
                <dd className="pd-sanction-view">
                  {sanctionDoc ? (
                    <a href={storedFileUrl(sanctionDoc.url)} target="_blank" rel="noopener noreferrer" onClick={storedFileClick(sanctionDoc.url)}><i className={`fa ${sanctionDoc.is_link ? 'fa-link' : 'fa-file-pdf-o'}`} aria-hidden="true"></i> {sanctionDoc.name}</a>
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
          <ProjectBudgetCard key={id} projectId={view.id} budget={budgetData} meta={view.options} canEdit={canEdit} onSaved={setBudgetData} />
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
                onChange={(e) => setDocForm({ ...docForm, name: e.target.value })}
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
                <input id="project-details-document-link" type="url" value={sanctionLinkInput} onChange={(e) => setSanctionLinkInput(e.target.value)} placeholder="https://… link to sanction letter" />
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

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { view, failed, retry, reload } = useView('project', { id }, { kept: false });

  if (failed) {
    return <LoadError message="Could not load this project. Check your connection and try again." onRetry={retry} />;
  }
  if (!view) return <StatusNotice tone="loading" title="Loading project" />;
  if (!view.id) {
    return (
      <StatusNotice
        tone="empty"
        title="Project not found."
        action={<CustomButton text="Go back" variant="quiet" onClick={() => navigate('/projects')} />}
      />
    );
  }
  // Another project starts clean: the last one's half-made edits stay behind.
  return <Project key={id} view={view} reload={reload} />;
};

export default ProjectDetails;
