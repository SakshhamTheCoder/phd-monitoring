import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { filterProjects, formatCurrency } from '../../data/projectsData';
import { apiListProjects, apiProjectStats, apiDeleteProject } from '../../api/projects';
import './ProjectsOverview.css';

const emptyStats = { active: 0, completed: 0, totalFunding: 0, consultancy: 0, industry: 0, international: 0 };

const ProjectsOverview = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filteredProjects = filterProjects(projects, activeFilter);

  const loadData = async () => {
    const [list, s] = await Promise.all([apiListProjects(), apiProjectStats()]);
    setProjects(list);
    setStats(s);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleEdit = (e, project) => {
    e.stopPropagation();
    navigate('/projects/create', { state: { editProject: project } });
  };

  const handleDelete = (e, project) => {
    e.stopPropagation();
    setDeleteTarget(project);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    const res = await apiDeleteProject(target.id);
    if (res.success) {
      setProjects((prev) => prev.filter((p) => p.id !== target.id));
      apiProjectStats().then(setStats);
    }
  };

  const filters = ['All', 'Active', 'Completed', 'In-house', 'Research', 'Consultancy', 'Industry', 'International'];

  const categoryColors = {
    Research: { bg: '#fee2e2', color: '#b91c1c' },
    Consultancy: { bg: '#fef3c7', color: '#92400e' },
    International: { bg: '#fce7f3', color: '#9d174d' },
    'In-house': { bg: '#e0e7ff', color: '#3730a3' },
    Industry: { bg: '#d1fae5', color: '#065f46' },
    Other: { bg: '#f3f4f6', color: '#374151' },
  };

  const statusColors = {
    Active: { bg: '#dcfce7', color: '#15803d' },
    Completed: { bg: '#dcfce7', color: '#15803d' },
    Pending: { bg: '#fef9c3', color: '#a16207' },
    'On Hold': { bg: '#fee2e2', color: '#b91c1c' },
  };

  const handleExportCSV = () => {
    const headers = ['Project Title', 'Category', 'Role', 'Funding Agency', 'Amount', 'Status'];
    const rows = filteredProjects.map(p => [p.title, p.category, p.role, p.fundingAgency, p.amount, p.status]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="po-container">
        {/* Page Header */}
        <div className="po-header">
          <div className="po-header-left">
            <h1 className="po-page-title">Projects Overview</h1>
            <p className="po-subtitle">Monitoring all ongoing research initiatives and funding channels.</p>
          </div>
          <button className="po-create-btn" onClick={() => navigate('/projects/create')}>
            <i className="fa fa-plus"></i> Create Project
          </button>
        </div>

        {/* Stats Cards */}
        <div className="po-stats-grid">
          <div className="po-stat-card">
            <div className="po-stat-header">
              <span className="po-stat-label">ACTIVE PROJECTS</span>
              <span className="po-stat-icon active"><i className="fa fa-rocket"></i></span>
            </div>
            <span className="po-stat-value">{String(stats.active).padStart(2, '0')}</span>
            <span className="po-stat-trend up"><i className="fa fa-arrow-up"></i> +12% this quarter</span>
          </div>
          <div className="po-stat-card">
            <div className="po-stat-header">
              <span className="po-stat-label">COMPLETED</span>
              <span className="po-stat-icon completed"><i className="fa fa-check-circle"></i></span>
            </div>
            <span className="po-stat-value accent">{String(stats.completed).padStart(2, '0')}</span>
            <span className="po-stat-meta">Cumulative 2015–2026</span>
          </div>
          <div className="po-stat-card wide">
            <div className="po-stat-header">
              <span className="po-stat-label">TOTAL FUNDING RECEIVED</span>
              <span className="po-stat-icon funding"><i className="fa fa-inr"></i></span>
            </div>
            <span className="po-stat-value large">{formatCurrency(stats.totalFunding)}</span>
            <div className="po-funding-split">
              <span className="po-dot internal"></span> Internal: {formatCurrency(stats.totalFunding * 0.6)}
              <span className="po-dot external"></span> External: {formatCurrency(stats.totalFunding * 0.4)}
            </div>
          </div>
          <div className="po-stat-card">
            <div className="po-stat-header">
              <span className="po-stat-label">CONSULTANCY</span>
              <span className="po-stat-icon consultancy"><i className="fa fa-handshake-o"></i></span>
            </div>
            <span className="po-stat-value">{String(stats.consultancy).padStart(2, '0')}</span>
            <span className="po-stat-meta">Current active</span>
          </div>
          <div className="po-stat-card">
            <div className="po-stat-header">
              <span className="po-stat-label">INTERNATIONAL</span>
              <span className="po-stat-icon international"><i className="fa fa-globe"></i></span>
            </div>
            <span className="po-stat-value">{String(stats.international).padStart(2, '0')}</span>
            <span className="po-stat-meta">Collaborative</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="po-filter-bar">
          <div className="po-filter-row">
            <span className="po-filter-label">FILTERS:</span>
            <div className="po-filter-pills">
              {filters.map(f => (
                <button
                  key={f}
                  className={`po-filter-pill ${activeFilter === f ? 'active' : ''}`}
                  onClick={() => setActiveFilter(f)}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <button className="po-export-btn" onClick={handleExportCSV}>
            <i className="fa fa-download"></i> EXPORT CSV
          </button>
        </div>

        {/* Projects Table */}
        <div className="po-table-wrapper">
          <table className="po-table">
            <thead>
              <tr>
                <th>PROJECT TITLE</th>
                <th>CATEGORY</th>
                <th>ROLE</th>
                <th>FUNDING AGENCY</th>
                <th>AMOUNT</th>
                <th>STATUS</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map(project => (
                <tr key={project.id} onClick={() => navigate(`/projects/${project.id}`)} className="po-row-clickable">
                  <td>
                    <div className="po-project-title">{project.title}</div>
                  </td>
                  <td>
                    <span className="po-category-badge" style={{ background: categoryColors[project.category]?.bg, color: categoryColors[project.category]?.color }}>
                      {project.category}
                    </span>
                  </td>
                  <td>{project.role}</td>
                  <td>{project.fundingAgency}</td>
                  <td className="po-amount">{formatCurrency(project.amount)}</td>
                  <td>
                    <span className="po-status-badge" style={{ background: statusColors[project.status]?.bg, color: statusColors[project.status]?.color }}>
                      <span className="po-status-dot" style={{ background: statusColors[project.status]?.color }}></span>
                      {project.status}
                    </span>
                  </td>
                  <td>
                    <div className="po-action-buttons">
                      <button
                        className="po-icon-btn edit"
                        title="Edit project"
                        onClick={(e) => handleEdit(e, project)}
                      >
                        <i className="fa fa-pencil"></i>
                      </button>
                      <button
                        className="po-icon-btn delete"
                        title="Delete project"
                        onClick={(e) => handleDelete(e, project)}
                      >
                        <i className="fa fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading ? (
            <div className="po-empty">Loading projects…</div>
          ) : filteredProjects.length === 0 && (
            <div className="po-empty">No projects found for the selected filter.</div>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="po-modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="po-modal" onClick={(e) => e.stopPropagation()}>
              <div className="po-modal-icon">
                <i className="fa fa-exclamation-triangle"></i>
              </div>
              <h3 className="po-modal-title">Delete Project</h3>
              <p className="po-modal-text">
                Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This action cannot be undone.
              </p>
              <div className="po-modal-actions">
                <button className="po-modal-btn cancel" onClick={() => setDeleteTarget(null)}>
                  Cancel
                </button>
                <button className="po-modal-btn confirm" onClick={confirmDelete}>
                  <i className="fa fa-trash"></i> Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ProjectsOverview;
