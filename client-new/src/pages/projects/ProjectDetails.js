import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { getProjectById, formatCurrency, getMilestoneProgress, milestoneStatusOptions } from '../../data/projectsData';
import './ProjectDetails.css';

const TABS = ['Overview', 'Funding & Budget', 'Milestones', 'Project Team', 'Documents'];

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const project = getProjectById(id);
  const [milestones, setMilestones] = useState(project ? [...project.milestones] : []);
  const [editingIdx, setEditingIdx] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMs, setNewMs] = useState({ name: '', deliverable: '', dueDate: '', status: 'Not Started' });

  const startEdit = (i) => { setEditingIdx(i); setEditForm({ ...milestones[i] }); };
  const cancelEdit = () => { setEditingIdx(null); };
  const saveEdit = () => { const updated = [...milestones]; updated[editingIdx] = { ...editForm }; setMilestones(updated); setEditingIdx(null); };
  const addMilestone = () => { if (newMs.name.trim()) { setMilestones([...milestones, { ...newMs }]); setNewMs({ name: '', deliverable: '', dueDate: '', status: 'Not Started' }); setShowAddForm(false); } };

  if (!project) {
    return <Layout><div className="pd-empty">Project not found. <button onClick={() => navigate('/projects')}>Go Back</button></div></Layout>;
  }

  const progress = getMilestoneProgress(milestones);
  const categoryColors = { Research: '#b91c1c', Consultancy: '#92400e', International: '#9d174d', 'In-house': '#3730a3', Industry: '#065f46' };
  const statusColors = { Active: '#15803d', Completed: '#15803d', Pending: '#a16207', 'On Hold': '#b91c1c', 'In Progress': '#c2410c' };
  const msIcons = { Completed: '✔', 'In Progress': '🟡', 'Not Started': '🔴', Delayed: '🔴' };

  const budgetYears = Object.keys(project.budget || {});
  const budgetHeads = budgetYears.length > 0 ? [...new Set(budgetYears.flatMap(y => Object.keys(project.budget[y])))] : [];
  const yearTotal = (y) => Object.values(project.budget[y] || {}).reduce((s, v) => s + v, 0);
  const headTotal = (h) => budgetYears.reduce((s, y) => s + (project.budget[y]?.[h] || 0), 0);
  const grandTotal = budgetYears.reduce((s, y) => s + yearTotal(y), 0);

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
              <div className="pd-progress-card">
                <div className="pd-progress-icon"><i className="fa fa-line-chart"></i></div>
                <span className="pd-progress-label">CURRENT PROGRESS</span>
                <span className="pd-progress-value">{progress}%</span>
                <div className="pd-progress-bar"><div className="pd-progress-fill" style={{ width: `${progress}%` }}></div></div>
                <p className="pd-progress-note">
                  {progress < 100
                    ? `On track for Milestone ${project.milestones.filter(m => m.status === 'Completed').length + 1} completion.`
                    : 'All milestones completed!'}
                </p>
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
              {project.sanctionLetterLink && (
                <div className="pd-fund-item"><span>Sanction Letter</span><a href={project.sanctionLetterLink}><i className="fa fa-file-pdf-o"></i> View Document</a></div>
              )}
            </div>
          </div>
          {budgetYears.length > 0 && (
            <div className="pd-card">
              <h3 className="pd-card-title"><i className="fa fa-table"></i> Budget Breakdown</h3>
              <div className="pd-budget-wrap">
                <table className="pd-budget-table">
                  <thead>
                    <tr>
                      <th>Budget Head</th>
                      {budgetYears.map((y, i) => <th key={y}>Year {i + 1}</th>)}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetHeads.map(h => (
                      <tr key={h}>
                        <td className="pd-bh-name">{h}</td>
                        {budgetYears.map(y => <td key={y}>₹{(project.budget[y]?.[h] || 0).toLocaleString('en-IN')}</td>)}
                        <td className="pd-bh-total">₹{headTotal(h).toLocaleString('en-IN')}</td>
                      </tr>
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
                  <div className="pd-ms-field"><label>Deliverable</label><input type="text" value={newMs.deliverable} onChange={e => setNewMs({...newMs, deliverable: e.target.value})} placeholder="e.g. Working demo" /></div>
                  <div className="pd-ms-field"><label>Due Date</label><input type="date" value={newMs.dueDate} onChange={e => setNewMs({...newMs, dueDate: e.target.value})} /></div>
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
                          <div className="pd-ms-field"><label>Name</label><input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></div>
                          <div className="pd-ms-field"><label>Deliverable</label><input type="text" value={editForm.deliverable} onChange={e => setEditForm({...editForm, deliverable: e.target.value})} /></div>
                          <div className="pd-ms-field"><label>Due Date</label><input type="date" value={editForm.dueDate} onChange={e => setEditForm({...editForm, dueDate: e.target.value})} /></div>
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
                        <span className="pd-tl-date"><i className="fa fa-calendar"></i> Due: {m.dueDate}</span>
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
            <div className="pd-team-card">
              <div className="pd-team-avatar">{project.pi.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
              <div className="pd-team-info">
                <h4>{project.pi.name}</h4>
                <p className="pd-team-dept">{project.pi.department}</p>
                <p className="pd-team-meta">{project.pi.designation}</p>
              </div>
              <span className="pd-team-role pi">PI</span>
            </div>
          </div>
          {project.coPIs.length > 0 && (
            <div className="pd-card">
              <h3 className="pd-card-title"><i className="fa fa-users"></i> Co-Investigators</h3>
              {project.coPIs.map((c, i) => (
                <div key={i} className="pd-team-card">
                  <div className="pd-team-avatar co">{c.name.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
                  <div className="pd-team-info">
                    <h4>{c.name}</h4>
                    <p className="pd-team-dept">{c.type === 'internal' ? c.department : c.institute}</p>
                    <p className="pd-team-meta">{c.designation}</p>
                  </div>
                  <span className={`pd-team-role ${c.type}`}>{c.type === 'internal' ? 'Internal' : 'External'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'Documents': return (
        <div className="pd-tab-content">
          <div className="pd-card">
            <h3 className="pd-card-title"><i className="fa fa-folder-open"></i> Project Documents</h3>
            {project.documents.length > 0 ? (
              <div className="pd-doc-list">
                {project.documents.map((d, i) => (
                  <div key={i} className="pd-doc-item">
                    <i className="fa fa-file-pdf-o pd-doc-icon"></i>
                    <div className="pd-doc-info"><strong>{d.name}</strong><span>{d.type} &middot; {d.date}</span></div>
                    <button className="pd-doc-dl"><i className="fa fa-download"></i></button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="pd-doc-empty">No documents uploaded yet.</p>
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
          <div className="pd-header-top">
            <span className="pd-header-cat" style={{ color: categoryColors[project.category] || '#555' }}>
              <i className="fa fa-flask"></i> {project.category.toUpperCase()}
            </span>
            <span className="pd-header-status" style={{ background: statusColors[project.status], color: '#FFF' }}>{project.status}</span>
          </div>
          <h1 className="pd-header-title">{project.title}</h1>
          <div className="pd-header-meta">
            <div className="pd-hm-item"><span>FUNDING AGENCY</span><strong>{project.fundingAgency}</strong></div>
            <div className="pd-hm-item"><span>SANCTIONED AMOUNT</span><strong>₹ {project.amount.toLocaleString('en-IN')}</strong></div>
          </div>
          <div className="pd-header-meta">
            <div className="pd-hm-item"><span>DURATION</span><strong>{project.durationYears * 12 + (project.durationMonths || 0)} Months ({project.startDate} — {project.endDate})</strong></div>
          </div>
          <div className="pd-header-actions">
            <button className="pd-hire-btn" onClick={() => navigate(`/projects/${id}/recruit`)}><i className="fa fa-user-plus"></i> Hire JRF</button>
            <button className="pd-hire-btn secondary" onClick={() => navigate(`/projects/${id}/recruit`)}><i className="fa fa-graduation-cap"></i> Hire Intern</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="pd-tabs">
          {TABS.map(tab => (
            <button key={tab} className={`pd-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>{tab}</button>
          ))}
        </div>

        {renderTab()}
      </div>
    </Layout>
  );
};

export default ProjectDetails;
