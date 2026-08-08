import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { formatCurrency, getMilestoneProgress, milestoneStatusOptions, budgetHeadTemplate, formatDate, subVal, subSum, cellMismatch, budgetMismatches, setSubCell } from '../../data/projectsData';
import { apiGetProject, apiUpdateProject, apiAddMilestone, apiUpdateMilestone, apiAddDocument, apiUpdateDocument, apiDeleteDocument, fileUrl, mapMilestone, mapDocument } from '../../api/projects';
import InputSuggestions from '../../components/forms/fields/InputSuggestions';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import { baseURL } from '../../api/urls';
import { toast } from 'react-toastify';
import './ProjectDetails.css';

// Build the sanction-letter display object from a loaded project.
const sanctionFromProject = (p) => {
  if (!p || !p.sanctionLetterLink || p.sanctionLetterLink === '#') return null;
  const isLink = /^https?:\/\//i.test(p.sanctionLetterLink);
  return { name: p.sanctionLetterName || 'Sanction Letter', url: fileUrl(p.sanctionLetterLink), isLink };
};

const TABS = ['Overview', 'Funding & Budget', 'Milestones', 'Project Team', 'Documents'];

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [milestones, setMilestones] = useState([]);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMs, setNewMs] = useState({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });

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
    const res = await apiAddMilestone(project.id, newMs);
    if (res.success) {
      setMilestones(prev => [...prev, mapMilestone(res.response)]);
      setNewMs({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
      setShowAddForm(false);
      toast.success('Milestone added.');
    }
  };

  // Budget breakdown inline editing (heads + sub-items, kept reconciled).
  // Sub-item amounts live under a reserved `__subitems` key: budget.__subitems[year][head][sub].
  const [budgetData, setBudgetData] = useState({});
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});
  const startBudgetEdit = () => { setBudgetDraft(JSON.parse(JSON.stringify(budgetData))); setEditingBudget(true); };
  const cancelBudgetEdit = () => setEditingBudget(false);
  const updateBudgetCell = (year, head, value) => {
    setBudgetDraft(prev => ({ ...prev, [year]: { ...prev[year], [head]: value === '' ? 0 : Number(value) } }));
  };
  const updateSubCell = (year, head, sub, value) => {
    setBudgetDraft(prev => setSubCell(prev, year, head, sub, value));
  };
  const saveBudgetEdit = async () => {
    const mism = budgetMismatches(budgetDraft);
    if (mism.length) {
      toast.error(`Sub-item totals don't match the head amount for: ${mism.join(', ')}. Fix the highlighted cells.`);
      return;
    }
    const res = await apiUpdateProject(project.id, { budget: budgetDraft });
    if (res.success) { setBudgetData(budgetDraft); setEditingBudget(false); toast.success('Budget updated successfully!'); }
  };

  // Co-PI management. An internal Co-PI must carry a faculty_code, since that is
  // what grants them access to the project.
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
    if (res.success) { setCoPIs(updated); setNewCopi(emptyCopi); setShowCopiForm(false); toast.success('Co-PI added successfully!'); }
  };
  const removeCopi = async (i) => {
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
    if (res.success) { setCoPIs(updated); setEditingCopiIdx(null); toast.success('Co-PI updated successfully!'); }
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
    const res = editingDocIdx !== null
      ? await apiUpdateDocument(project.id, documents[editingDocIdx].id, fd)
      : await apiAddDocument(project.id, fd);
    if (res.success) {
      const doc = mapDocument((res.response && res.response.document) || res.response);
      setDocuments(prev => (editingDocIdx !== null ? prev.map((d, i) => (i === editingDocIdx ? doc : d)) : [...prev, doc]));
      setShowDocModal(false);
      toast.success(editingDocIdx !== null ? 'Document updated!' : 'Document uploaded successfully!');
    }
  };
  const removeDoc = async (i) => {
    const d = documents[i];
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
      const res = await apiUpdateProject(project.id, fd, true);
      if (res.success) {
        const p = await apiGetProject(id);
        if (p) setSanctionDoc(sanctionFromProject(p));
        setShowSanctionModal(false);
        toast.success('Sanction letter updated!');
      }
    } else {
      if (!sanctionLinkInput.trim()) { toast.error('Please enter a link.'); return; }
      const res = await apiUpdateProject(project.id, { sanction_letter_link: sanctionLinkInput.trim(), sanction_letter_name: 'Sanction Letter' });
      if (res.success) {
        setSanctionDoc({ name: 'Sanction Letter', url: sanctionLinkInput.trim(), isLink: true });
        setShowSanctionModal(false);
        toast.success('Sanction letter updated!');
      }
    }
  };

  // Load the project on mount and sync all sub-states from it.
  const loadProject = async () => {
    const p = await apiGetProject(id);
    if (p) {
      setProject(p);
      setMilestones(p.milestones || []);
      setBudgetData(p.budget || {});
      setCoPIs(p.coPIs || []);
      setDocuments(p.documents || []);
      setSanctionDoc(sanctionFromProject(p));
    }
    setLoading(false);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProject(); }, [id]);

  if (loading) {
    return <Layout><div className="pd-empty">Loading project…</div></Layout>;
  }
  if (!project) {
    return <Layout><div className="pd-empty">Project not found. <button onClick={() => navigate('/projects')}>Go Back</button></div></Layout>;
  }

  const progress = getMilestoneProgress(milestones);
  const categoryColors = { Research: '#b91c1c', Consultancy: '#92400e', International: '#9d174d', 'In-house': '#3730a3', Industry: '#065f46' };
  const statusColors = { Active: '#15803d', Completed: '#15803d', Pending: '#a16207', 'On Hold': '#b91c1c', 'In Progress': '#c2410c' };
  const msIcons = { Completed: '✔', 'In Progress': '🟡', 'Not Started': '🔴', Delayed: '🔴' };

  const activeBudget = editingBudget ? budgetDraft : budgetData;
  const budgetYears = Object.keys(budgetData || {}).filter(k => k !== '__subitems');
  const yearTotal = (y) => Object.values(activeBudget[y] || {}).reduce((s, v) => s + Number(v || 0), 0);
  const headTotal = (h) => budgetYears.reduce((s, y) => s + Number(activeBudget[y]?.[h] || 0), 0);
  const grandTotal = budgetYears.reduce((s, y) => s + yearTotal(y), 0);
  // Total across all years for a single sub-item (for the sub-row Total column).
  const subYearTotal = (head, sub) => budgetYears.reduce((s, y) => s + subVal(activeBudget, y, head, sub), 0);

  const renderTab = () => {
    switch (activeTab) {
      case 'Overview': return (
        <div className="pd-tab-content">
          <div className="pd-overview-grid">
            <div className="pd-overview-main">
              <div className="pd-card">
                <h3 className="pd-card-title"><i className="fa fa-bullseye"></i> Project Objectives</h3>
                <ul className="pd-obj-list">
                  {project.objectives.map((obj, i) => (
                    <li key={i}><strong>{obj.title}:</strong> {obj.description}</li>
                  ))}
                </ul>
              </div>
              <div className="pd-card">
                <h3 className="pd-card-title"><i className="fa fa-align-left"></i> Detailed Description</h3>
                <p className="pd-description">{project.description}</p>
              </div>
            </div>
            <div className="pd-overview-side">
              <div className="pd-card pd-meta-card">
                <h4 className="pd-meta-title">PROJECT METADATA</h4>
                <div className="pd-meta-row"><span>Primary Category</span><strong>{project.category}</strong></div>
                <div className="pd-meta-row"><span>Focus Area</span><strong>{project.focusArea}</strong></div>
                <div className="pd-meta-row"><span>Grant Type</span><strong>{project.grantType}</strong></div>
                <div className="pd-meta-row"><span>Project Status</span><strong style={{ color: statusColors[project.status] }}>{project.status}</strong></div>
              </div>
            </div>
          </div>
        </div>
      );

      case 'Funding & Budget': return (
        <div className="pd-tab-content">
          <div className="pd-card">
            <h3 className="pd-card-title"><i className="fa fa-inr"></i> Funding Summary</h3>
            <div className="pd-funding-summary">
              <div className="pd-fund-item"><span>Funding Agency</span><strong>{project.fundingAgency}</strong></div>
              <div className="pd-fund-item"><span>Total Sanctioned</span><strong>{formatCurrency(project.amount)}</strong></div>
              <div className="pd-fund-item"><span>TIET Share</span><strong>{formatCurrency(project.tietShare)}</strong></div>
              <div className="pd-fund-item">
                <span>Sanction Letter</span>
                <div className="pd-sanction-view">
                  {sanctionDoc ? (
                    <a href={sanctionDoc.url} target="_blank" rel="noopener noreferrer"><i className={`fa ${sanctionDoc.isLink ? 'fa-link' : 'fa-file-pdf-o'}`}></i> {sanctionDoc.name}</a>
                  ) : (
                    <span className="pd-sanction-none">Not uploaded</span>
                  )}
                  <button
                    className="pd-sanction-edit-btn"
                    onClick={openSanctionModal}
                    title={sanctionDoc ? 'Edit sanction letter' : 'Add sanction letter'}
                  >
                    <i className={`fa ${sanctionDoc ? 'fa-pencil' : 'fa-plus'}`}></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {budgetYears.length > 0 && (
            <div className="pd-card">
              <div className="pd-budget-header">
                <h3 className="pd-card-title" style={{ marginBottom: 0 }}><i className="fa fa-table"></i> Budget Breakdown</h3>
                <div className="pd-budget-actions">
                  {editingBudget ? (
                    <>
                      <button className="pd-ms-cancel" onClick={cancelBudgetEdit}>Cancel</button>
                      <button className="pd-ms-save" onClick={saveBudgetEdit}><i className="fa fa-check"></i> Save Changes</button>
                    </>
                  ) : (
                    <button className="pd-add-ms-btn" onClick={startBudgetEdit}><i className="fa fa-pencil"></i> Edit Budget</button>
                  )}
                </div>
              </div>
              <div className="pd-budget-wrap">
                <table className="pd-budget-table">
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
                        <tr className="pd-budget-head-row">
                          <td className="pd-budget-head-name">{bh.head}</td>
                          {budgetYears.map(y => {
                            const mism = editingBudget && bh.subItems.length > 0 && cellMismatch(budgetDraft, y, bh.head);
                            return (
                              <td key={y}>
                                {editingBudget ? (
                                  <input
                                    type="number"
                                    className={`pd-budget-edit-input${mism ? ' pd-budget-mismatch' : ''}`}
                                    value={budgetDraft[y]?.[bh.head] ?? 0}
                                    onChange={e => updateBudgetCell(y, bh.head, e.target.value)}
                                    title={mism ? `Sub-items sum to ₹${subSum(budgetDraft, y, bh.head).toLocaleString('en-IN')}` : undefined}
                                  />
                                ) : (
                                  <>₹{(budgetData[y]?.[bh.head] || 0).toLocaleString('en-IN')}</>
                                )}
                              </td>
                            );
                          })}
                          <td className="pd-bh-total">₹{headTotal(bh.head).toLocaleString('en-IN')}</td>
                        </tr>
                        {bh.subItems.map(sub => (
                          <tr key={sub} className="pd-budget-sub-row">
                            <td className="pd-budget-sub-name">↳ {sub}</td>
                            {budgetYears.map(y => (
                              <td key={y} className="pd-budget-sub-cell">
                                {editingBudget ? (
                                  <input
                                    type="number"
                                    className="pd-budget-edit-input sub"
                                    value={subVal(budgetDraft, y, bh.head, sub) || 0}
                                    onChange={e => updateSubCell(y, bh.head, sub, e.target.value)}
                                  />
                                ) : (
                                  <>{subVal(budgetData, y, bh.head, sub) ? `₹${subVal(budgetData, y, bh.head, sub).toLocaleString('en-IN')}` : '—'}</>
                                )}
                              </td>
                            ))}
                            <td className="pd-budget-sub-total">{subYearTotal(bh.head, sub) ? `₹${subYearTotal(bh.head, sub).toLocaleString('en-IN')}` : ''}</td>
                          </tr>
                        ))}
                        {editingBudget && bh.subItems.length > 0 && (
                          <tr className="pd-budget-subsum-row">
                            <td className="pd-budget-sub-name">↳ sub-items total</td>
                            {budgetYears.map(y => {
                              const ss = subSum(budgetDraft, y, bh.head);
                              const bad = cellMismatch(budgetDraft, y, bh.head);
                              return <td key={y} className={`pd-budget-subsum ${bad ? 'bad' : (ss > 0 ? 'ok' : '')}`}>₹{ss.toLocaleString('en-IN')}{bad ? ' ⚠' : (ss > 0 ? ' ✓' : '')}</td>;
                            })}
                            <td></td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                    <tr className="pd-grand-row">
                      <td><strong>Grand Total</strong></td>
                      {budgetYears.map(y => <td key={y}><strong>₹{yearTotal(y).toLocaleString('en-IN')}</strong></td>)}
                      <td className="pd-grand-total"><strong>₹{grandTotal.toLocaleString('en-IN')}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {project.equipmentDetails.length > 0 && (
                <>
                  <h4 className="pd-sub-title">Equipment Details</h4>
                  <div className="pd-equip-list">
                    {project.equipmentDetails.map((eq, i) => (
                      <div key={i} className="pd-equip-item"><span>{eq.item}</span><strong>₹{eq.amount.toLocaleString('en-IN')}</strong></div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      );

      case 'Milestones': return (
        <div className="pd-tab-content">
          <div className="pd-card">
            <div className="pd-ms-header">
              <h3 className="pd-card-title"><i className="fa fa-flag"></i> Project Milestones</h3>
              <div className="pd-ms-header-right">
                <div className="pd-ms-progress">
                  <span className="pd-ms-pct">{progress}%</span>
                  <div className="pd-ms-bar"><div className="pd-ms-fill" style={{ width: `${progress}%` }}></div></div>
                </div>
                <button className="pd-add-ms-btn" onClick={() => setShowAddForm(!showAddForm)}>
                  <i className="fa fa-plus"></i> Add Milestone
                </button>
              </div>
            </div>

            {/* Add Milestone Form */}
            {showAddForm && (
              <div className="pd-ms-add-form">
                <h4 className="pd-ms-form-title">New Milestone</h4>
                <div className="pd-ms-form-grid">
                  <div className="pd-ms-field"><label>Milestone Name *</label><input type="text" value={newMs.name} onChange={e => setNewMs({...newMs, name: e.target.value})} placeholder="e.g. Prototype Delivery" /></div>
                  <div className="pd-ms-field"><label>Deliverable *</label><input type="text" value={newMs.deliverable} onChange={e => setNewMs({...newMs, deliverable: e.target.value})} placeholder="e.g. Working demo" /></div>
                  <div className="pd-ms-field"><label>Due Date *</label><input type="date" value={newMs.dueDate} onChange={e => setNewMs({...newMs, dueDate: e.target.value})} /></div>
                  <div className="pd-ms-field"><label>Status</label>
                    <select value={newMs.status} onChange={e => setNewMs({...newMs, status: e.target.value})}>
                      {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="pd-ms-form-actions">
                  <button className="pd-ms-cancel" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button className="pd-ms-save" onClick={addMilestone}><i className="fa fa-plus"></i> Add</button>
                </div>
              </div>
            )}

            <div className="pd-timeline">
              {milestones.map((m, i) => (
                <div key={i} className={`pd-tl-item ${m.status.toLowerCase().replace(' ', '-')}`}>
                  <div className="pd-tl-icon">{msIcons[m.status]}</div>
                  <div className="pd-tl-content">
                    {editingIdx === i ? (
                      /* Inline Edit Mode */
                      <div className="pd-ms-edit-form">
                        <div className="pd-ms-form-grid">
                          <div className="pd-ms-field"><label>Name *</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                          <div className="pd-ms-field"><label>Deliverable *</label><input type="text" value={editForm.deliverable} onChange={e => setEditForm({...editForm, deliverable: e.target.value})} /></div>
                          <div className="pd-ms-field"><label>Due Date *</label><input type="date" value={editForm.dueDate} onChange={e => setEditForm({...editForm, dueDate: e.target.value})} /></div>
                          <div className="pd-ms-field"><label>Status</label>
                            <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                              {milestoneStatusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="pd-ms-form-actions">
                          <button className="pd-ms-cancel" onClick={cancelEdit}>Cancel</button>
                          <button className="pd-ms-save" onClick={saveEdit}><i className="fa fa-check"></i> Save</button>
                        </div>
                      </div>
                    ) : (
                      /* Display Mode */
                      <>
                        <div className="pd-tl-top">
                          <h4>{m.name}</h4>
                          <div className="pd-tl-actions">
                            <span className={`pd-tl-badge ${m.status.toLowerCase().replace(' ', '-')}`}>{m.status}</span>
                            <button className="pd-tl-edit-btn" onClick={() => startEdit(i)} title="Edit milestone"><i className="fa fa-pencil"></i></button>
                          </div>
                        </div>
                        <p className="pd-tl-deliverable">{m.deliverable}</p>
                        <span className="pd-tl-date"><i className="fa fa-calendar"></i> Due: {formatDate(m.dueDate)}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

      case 'Project Team': return (
        <div className="pd-tab-content">
          <div className="pd-card">
            <h3 className="pd-card-title"><i className="fa fa-user"></i> Principal Investigator</h3>
            {project.pi ? (
              <div className="pd-team-card">
                <div className="pd-team-avatar">{project.pi.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                <div className="pd-team-info">
                  <h4>{project.pi.name}</h4>
                  <p className="pd-team-dept">{project.pi.department}</p>
                  <p className="pd-team-meta">{project.pi.designation}</p>
                </div>
                <span className="pd-team-role pi">PI</span>
              </div>
            ) : (
              <p className="empty-state">No principal investigator on record for this project.</p>
            )}
          </div>
          <div className="pd-card">
            <div className="pd-ms-header">
              <h3 className="pd-card-title"><i className="fa fa-users"></i> Co-PIs</h3>
              <button className="pd-add-ms-btn" onClick={() => setShowCopiForm(!showCopiForm)}>
                <i className="fa fa-plus"></i> Add Co-PI
              </button>
            </div>

            {showCopiForm && (
              <div className="pd-ms-add-form">
                <h4 className="pd-ms-form-title">New Co-PI</h4>
                <div className="pd-ms-form-grid">
                  <div className="pd-ms-field"><label>Type</label>
                    <select value={newCopi.type} onChange={e => setNewCopi({ ...emptyCopi, type: e.target.value })}>
                      <option value="internal">Internal</option>
                      <option value="external">External</option>
                    </select>
                  </div>
                  {newCopi.type === 'internal' ? (
                    <div className="pd-ms-field">
                      <InputSuggestions
                        apiUrl={`${baseURL}/suggestions/faculty`}
                        label="Faculty *"
                        hint="Type faculty name, code or email..."
                        fields={['name', 'department']}
                        onSelect={pickInternal(setNewCopi)}
                      />
                    </div>
                  ) : (
                    <div className="pd-ms-field"><label>Full Name *</label><input type="text" value={newCopi.name} onChange={e => setNewCopi({ ...newCopi, name: e.target.value })} placeholder="e.g. Dr. Robert Chen" /></div>
                  )}
                  <div className="pd-ms-field"><label>{newCopi.type === 'internal' ? 'Department' : 'Institute'}</label>
                    <input
                      type="text"
                      readOnly={newCopi.type === 'internal'}
                      value={newCopi.type === 'internal' ? newCopi.department : newCopi.institute}
                      onChange={e => setNewCopi(newCopi.type === 'internal' ? { ...newCopi, department: e.target.value } : { ...newCopi, institute: e.target.value })}
                      placeholder={newCopi.type === 'internal' ? 'Filled from the selected faculty' : 'e.g. MIT CSAIL'}
                    />
                  </div>
                  <div className="pd-ms-field"><label>Designation</label><input type="text" readOnly={newCopi.type === 'internal'} value={newCopi.designation} onChange={e => setNewCopi({ ...newCopi, designation: e.target.value })} placeholder="e.g. Professor" /></div>
                </div>
                <div className="pd-ms-form-actions">
                  <button className="pd-ms-cancel" onClick={() => { setShowCopiForm(false); setNewCopi(emptyCopi); }}>Cancel</button>
                  <button className="pd-ms-save" onClick={addCopi}><i className="fa fa-plus"></i> Add Co-PI</button>
                </div>
              </div>
            )}

            {coPIs.length > 0 ? coPIs.map((c, i) => (
              editingCopiIdx === i ? (
                <div key={i} className="pd-ms-add-form">
                  <h4 className="pd-ms-form-title">Edit Co-PI</h4>
                  <div className="pd-ms-form-grid">
                    <div className="pd-ms-field"><label>Type</label>
                      <select value={copiEditForm.type} onChange={e => setCopiEditForm({ ...emptyCopi, type: e.target.value })}>
                        <option value="internal">Internal</option>
                        <option value="external">External</option>
                      </select>
                    </div>
                    {copiEditForm.type === 'internal' ? (
                      <div className="pd-ms-field">
                        <InputSuggestions
                          apiUrl={`${baseURL}/suggestions/faculty`}
                          label="Faculty *"
                          hint="Type faculty name, code or email..."
                          initialValue={copiEditForm.name}
                          fields={['name', 'department']}
                          onSelect={pickInternal(setCopiEditForm)}
                        />
                      </div>
                    ) : (
                      <div className="pd-ms-field"><label>Full Name *</label><input type="text" value={copiEditForm.name} onChange={e => setCopiEditForm({ ...copiEditForm, name: e.target.value })} /></div>
                    )}
                    <div className="pd-ms-field"><label>{copiEditForm.type === 'internal' ? 'Department' : 'Institute'}</label>
                      <input
                        type="text"
                        readOnly={copiEditForm.type === 'internal'}
                        value={copiEditForm.type === 'internal' ? (copiEditForm.department || '') : (copiEditForm.institute || '')}
                        onChange={e => setCopiEditForm(copiEditForm.type === 'internal' ? { ...copiEditForm, department: e.target.value } : { ...copiEditForm, institute: e.target.value })}
                      />
                    </div>
                    <div className="pd-ms-field"><label>Designation</label><input type="text" readOnly={copiEditForm.type === 'internal'} value={copiEditForm.designation || ''} onChange={e => setCopiEditForm({ ...copiEditForm, designation: e.target.value })} /></div>
                  </div>
                  <div className="pd-ms-form-actions">
                    <button className="pd-ms-cancel" onClick={cancelCopiEdit}>Cancel</button>
                    <button className="pd-ms-save" onClick={saveCopiEdit}><i className="fa fa-check"></i> Save</button>
                  </div>
                </div>
              ) : (
                <div key={i} className="pd-team-card">
                  <div className="pd-team-avatar co">{c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                  <div className="pd-team-info">
                    <h4>{c.name}</h4>
                    <p className="pd-team-dept">{c.type === 'internal' ? c.department : c.institute}</p>
                    <p className="pd-team-meta">{c.designation}</p>
                  </div>
                  <span className={`pd-team-role ${c.type}`}>{c.type === 'internal' ? 'Internal' : 'External'}</span>
                  <button className="pd-copi-edit" onClick={() => startCopiEdit(i)} title="Edit Co-PI"><i className="fa fa-pencil"></i></button>
                  <button className="pd-copi-remove" onClick={() => removeCopi(i)} title="Remove Co-PI"><i className="fa fa-trash"></i></button>
                </div>
              )
            )) : (
              <p className="empty-state">No Co-PIs added yet.</p>
            )}
          </div>
        </div>
      );

      case 'Documents': return (
        <div className="pd-tab-content">
          <div className="pd-card">
            <div className="pd-ms-header">
              <h3 className="pd-card-title"><i className="fa fa-folder-open"></i> Project Documents</h3>
              <button className="pd-add-ms-btn" onClick={openAddDoc}>
                <i className="fa fa-plus"></i> Add Document
              </button>
            </div>
            {documents.length > 0 ? (
              <div className="pd-doc-list">
                {documents.map((d, i) => (
                  <div key={i} className="pd-doc-item">
                    <i className="fa fa-file-pdf-o pd-doc-icon"></i>
                    <div className="pd-doc-info"><strong>{d.name}</strong><span>{d.type} &middot; {formatDate(d.date)}</span></div>
                    <div className="pd-doc-actions">
                      {d.url && <a className="pd-doc-dl" href={d.url} target="_blank" rel="noopener noreferrer" title="View document"><i className="fa fa-eye"></i></a>}
                      <button className="pd-doc-edit" onClick={() => openEditDoc(i)} title="Edit document"><i className="fa fa-pencil"></i></button>
                      <button className="pd-doc-remove" onClick={() => removeDoc(i)} title="Delete document"><i className="fa fa-trash"></i></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">No documents uploaded yet.</p>
            )}
          </div>
        </div>
      );

      default: return null;
    }
  };

  return (
    <Layout>
      <div className="pd-container">
        <button className="pd-back-link" onClick={() => navigate('/projects')}>
          <i className="fa fa-arrow-left"></i> BACK TO PROJECTS
        </button>
        {/* Header */}
        <div className="pd-header">
          <div className="pd-header-main">
            <div className="pd-header-top">
              <span className="pd-header-cat" style={{ color: categoryColors[project.category] || '#555' }}>
                <i className="fa fa-flask"></i> {project.category.toUpperCase()}
              </span>
            </div>
            <h1 className="page-title">{project.title}</h1>
            <div className="pd-header-meta">
              <div className="pd-hm-item"><span>FUNDING AGENCY</span><strong>{project.fundingAgency}</strong></div>
              <div className="pd-hm-item"><span>SANCTIONED AMOUNT</span><strong>₹ {project.amount.toLocaleString('en-IN')}</strong></div>
            </div>
            <div className="pd-header-meta">
              <div className="pd-hm-item"><span>DURATION</span><strong>{project.durationYears * 12 + (project.durationMonths || 0)} Months ({formatDate(project.startDate)} — {formatDate(project.endDate)})</strong></div>
            </div>
            <div className="pd-header-actions">
              <button className="pd-hire-btn" onClick={() => navigate(`/projects/${id}/recruit`)}><i className="fa fa-user-plus"></i> Hire JRF</button>
              <button className="pd-hire-btn secondary" onClick={() => navigate(`/projects/${id}/recruit`)}><i className="fa fa-graduation-cap"></i> Hire Intern</button>
            </div>
          </div>
          <div className="pd-header-side">
            <span className="pd-header-status" style={{ background: statusColors[project.status], color: '#FFF' }}>{project.status}</span>
            <button className="pd-header-edit-btn" onClick={() => navigate('/projects/create', { state: { editProject: project } })}>
              <i className="fa fa-pencil"></i> Edit Project
            </button>
            <div className="pd-header-progress">
              <span className="pd-progress-label">CURRENT PROGRESS</span>
              <span className="pd-progress-value">{progress}%</span>
              <div className="pd-progress-bar"><div className="pd-progress-fill" style={{ width: `${progress}%` }}></div></div>
              <p className="pd-progress-note">
                {progress < 100
                  ? `On track for Milestone ${milestones.filter(m => m.status === 'Completed').length + 1} completion.`
                  : 'All milestones completed!'}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs pd-tabs">
          {TABS.map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        {renderTab()}

        {/* Add / Edit Document Modal */}
        {showDocModal && (
          <CustomModal
            isOpen={showDocModal}
            onClose={() => setShowDocModal(false)}
            title={editingDocIdx !== null ? 'Edit Document' : 'Add Document'}
            maxWidth="520px"
            minHeight="auto"
          >
            <>
              <div className="pd-modal-field">
                <label>Document Name <span className="req">*</span></label>
                <input
                  type="text"
                  value={docForm.name}
                  onChange={e => setDocForm({ ...docForm, name: e.target.value })}
                  placeholder="e.g. Year 1 Progress Report"
                />
              </div>
              <div className="pd-modal-field">
                <label>{editingDocIdx !== null ? 'Replace Document' : 'Upload Document'} {editingDocIdx !== null && <span className="pd-modal-hint">(optional — leave empty to keep the current file)</span>}</label>
                {editingDocIdx !== null && docForm.currentLabel && !docForm.fileName && (
                  <span className="pd-upload-selected" style={{ color: '#666' }}><i className="fa fa-paperclip"></i> {docForm.currentLabel}</span>
                )}
                <button type="button" className="pd-upload-label" onClick={() => docFileRef.current && docFileRef.current.click()}>
                  <i className="fa fa-upload"></i> {editingDocIdx !== null ? 'Replace file' : 'Select file from system'}
                </button>
                <input
                  type="file"
                  ref={docFileRef}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
                  onChange={handleDocFileSelect}
                />
                {docForm.fileName && <span className="pd-upload-selected"><i className="fa fa-check-circle"></i> {docForm.fileName}</span>}
              </div>
              <div className="modal-actions">
                <CustomButton text="Cancel" variant="secondary" onClick={() => setShowDocModal(false)} />
                <CustomButton text={editingDocIdx !== null ? 'Save Changes' : 'Add Document'} onClick={saveDoc} />
              </div>
            </>
          </CustomModal>
        )}

        {/* Sanction Letter Modal (file or link) */}
        {showSanctionModal && (
          <CustomModal
            isOpen={showSanctionModal}
            onClose={() => setShowSanctionModal(false)}
            title="Sanction Letter"
            maxWidth="520px"
            minHeight="auto"
          >
            <>
              <div className="pd-sanction-tabs">
                <button type="button" className={`pd-sanction-tab ${sanctionMode === 'file' ? 'active' : ''}`} onClick={() => setSanctionMode('file')}>
                  <i className="fa fa-upload"></i> Choose File
                </button>
                <button type="button" className={`pd-sanction-tab ${sanctionMode === 'link' ? 'active' : ''}`} onClick={() => setSanctionMode('link')}>
                  <i className="fa fa-link"></i> Paste Link
                </button>
              </div>
              {sanctionMode === 'file' ? (
                <div className="pd-modal-field">
                  <label>Choose File</label>
                  <button type="button" className="pd-upload-label" onClick={() => sanctionInputRef.current && sanctionInputRef.current.click()}>
                    <i className="fa fa-upload"></i> {sanctionFileSel ? 'Change file' : 'Select file from system'}
                  </button>
                  <input
                    type="file"
                    ref={sanctionInputRef}
                    style={{ display: 'none' }}
                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={handleSanctionFile}
                  />
                  {sanctionFileSel && <span className="pd-upload-selected"><i className="fa fa-check-circle"></i> {sanctionFileSel.name}</span>}
                </div>
              ) : (
                <div className="pd-modal-field">
                  <label>Document Link</label>
                  <input type="url" value={sanctionLinkInput} onChange={e => setSanctionLinkInput(e.target.value)} placeholder="https://… link to sanction letter" />
                </div>
              )}
              <div className="modal-actions">
                <CustomButton text="Cancel" variant="secondary" onClick={() => setShowSanctionModal(false)} />
                <CustomButton text="Save" onClick={saveSanctionModal} />
              </div>
            </>
          </CustomModal>
        )}
      </div>
    </Layout>
  );
};

export default ProjectDetails;
