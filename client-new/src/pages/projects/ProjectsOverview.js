import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import { filterProjects, formatCurrency } from '../../data/projectsData';
import { badgeClass } from '../../data/badges';
import { apiListProjects, apiProjectStats, apiDeleteProject } from '../../api/projects';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
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
        <div className="page-header">
          <div>
            <h1 className="page-title">Projects Overview</h1>
            <p className="page-subtitle">Monitoring all ongoing research initiatives and funding channels.</p>
          </div>
          <div className="page-actions">
            <button className="po-create-btn" onClick={() => navigate('/projects/create')}>
              <i className="fa fa-plus"></i> Create Project
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="po-stats-grid">
          <div className="po-stat-card">
            <div className="po-stat-header">
              <span className="po-stat-label">ACTIVE PROJECTS</span>
              <span className="po-stat-icon active"><i className="fa fa-rocket"></i></span>
            </div>
            <span className="po-stat-value">{String(stats.active).padStart(2, '0')}</span>
          </div>
          <div className="po-stat-card">
            <div className="po-stat-header">
              <span className="po-stat-label">COMPLETED</span>
              <span className="po-stat-icon completed"><i className="fa fa-check-circle"></i></span>
            </div>
            <span className="po-stat-value accent">{String(stats.completed).padStart(2, '0')}</span>
          </div>
          <div className="po-stat-card wide">
            <div className="po-stat-header">
              <span className="po-stat-label">TOTAL FUNDING RECEIVED</span>
              <span className="po-stat-icon funding"><i className="fa fa-inr"></i></span>
            </div>
            <span className="po-stat-value large">{formatCurrency(stats.totalFunding)}</span>
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
        <div className="data-table-wrap">
          <table className="data-table">
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
                    <span className={badgeClass(project.category)}>
                      {project.category}
                    </span>
                  </td>
                  <td>{project.role}</td>
                  <td>{project.fundingAgency}</td>
                  <td className="po-amount">{formatCurrency(project.amount)}</td>
                  <td>
                    <span className={badgeClass(project.status)}>{project.status}</span>
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
            <div className="empty-state">Loading projects…</div>
          ) : filteredProjects.length === 0 && (
            <div className="empty-state">No projects found for the selected filter.</div>
          )}
        </div>

        <CustomModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Project"
          maxWidth="420px"
          minHeight="auto"
        >
          <p className="po-modal-text">
            Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
          </p>
          <div className="modal-actions">
            <CustomButton text="Cancel" variant="secondary" onClick={() => setDeleteTarget(null)} />
            <CustomButton text="Delete" variant="danger" onClick={confirmDelete} />
          </div>
        </CustomModal>
      </div>
    </Layout>
  );
};

export default ProjectsOverview;
