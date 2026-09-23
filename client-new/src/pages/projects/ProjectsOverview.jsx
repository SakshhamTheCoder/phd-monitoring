import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDuration } from '../../data/projectsData';
import { badgeClass } from '../../data/badges';
import { apiListProjects, apiProjectStats, apiDeleteProject } from '../../api/projects';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import FilterBar from '../../components/filterBar/FilterBar';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import LoadError from '../../components/common/LoadError';
import useDoneFlash from '../../hooks/useDoneFlash';
import './ProjectsOverview.css';

const emptyStats = { active: 0, completed: 0, totalFunding: 0, consultancy: 0, industry: 0, international: 0 };

const ProjectsOverview = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState(null);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(emptyStats);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exported, flashExported] = useDoneFlash();

  useEffect(() => {
    // A slower answer to an older search must not overwrite the current one.
    let cancelled = false;
    Promise.all([apiListProjects(query), apiProjectStats()]).then(([list, s]) => {
      if (cancelled) return;
      setProjects(list || []);
      setLoadFailed(!list);
      setStats(s);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [query, loadAttempt]);

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

  const handleExportCSV = () => {
    const headers = ['Project Title', 'Category', 'Role', 'Funding Agency', 'Amount', 'Duration', 'Status'];
    const rows = projects.map(p => [p.title, p.category, p.role, p.fundingAgency, p.amount, formatDuration(p.durationYears, p.durationMonths), p.status]);
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'projects_export.csv';
    a.click();
    URL.revokeObjectURL(url);
    flashExported();
  };

  const facts = [
    { label: 'Active projects', value: String(stats.active).padStart(2, '0') },
    { label: 'Completed', value: String(stats.completed).padStart(2, '0') },
    { label: 'Total funding received', value: formatCurrency(stats.totalFunding) },
    { label: 'Consultancy', value: String(stats.consultancy).padStart(2, '0'), note: 'Current active' },
    { label: 'International', value: String(stats.international).padStart(2, '0'), note: 'Collaborative' },
  ];

  return (
    <Page
      title="Projects overview"
      description="Monitoring all ongoing research initiatives and funding channels."
      actions={<>
        <CustomButton text="Export CSV" variant="secondary" done={exported} onClick={handleExportCSV} />
        <CustomButton text="Create project" onClick={() => navigate('/projects/create')} />
      </>}
    >
      <Panel>
        <dl className="facts po-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd className="po-fact-value">{fact.value}</dd>
              {fact.note && <dd className="po-fact-note">{fact.note}</dd>}
            </div>
          ))}
        </dl>
      </Panel>

      <Panel flush>
        {/* Drawn as the head PagenationTable gives its search, so this hand
            drawn list reads the same as the server paged ones. */}
        <div className="panel-head">
          <div className="table-search po-search">
            <FilterBar onSearch={(q) => { setLoading(true); setQuery(q); }} />
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Project title</th>
                <th>Category</th>
                <th>Role</th>
                <th>Funding agency</th>
                <th>Amount</th>
                <th>Duration</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
                <th><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {projects.map(project => (
                <tr
                  key={project.id}
                  // reveal: a row arriving (first load, a new search) fades in.
                  className="row-link reveal"
                  tabIndex={0}
                  onClick={() => navigate(`/projects/${project.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${project.id}`)}
                >
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
                  <td>{formatCurrency(project.amount)}</td>
                  <td>{formatDuration(project.durationYears, project.durationMonths)}</td>
                  <td>
                    <span className={badgeClass(project.status)}>{project.status}</span>
                  </td>
                  <td>
                    <div className="po-action-buttons">
                      {project.canEdit ? (
                        <>
                          <button
                            type="button"
                            className="po-icon-btn"
                            title="Edit project"
                            aria-label="Edit project"
                            onClick={(e) => handleEdit(e, project)}
                          >
                            <i className="fa fa-pencil" aria-hidden="true"></i>
                          </button>
                          <button
                            type="button"
                            className="po-icon-btn delete"
                            title="Delete project"
                            aria-label="Delete project"
                            onClick={(e) => handleDelete(e, project)}
                          >
                            <i className="fa fa-trash" aria-hidden="true"></i>
                          </button>
                        </>
                      ) : (
                        <span className="po-readonly">View only</span>
                      )}
                    </div>
                  </td>
                  <td className="row-go" title="Open project"><i className="fa fa-angle-right" aria-hidden="true"></i></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(loading || loadFailed || projects.length === 0) && (
          <div className="po-state">
            {loading ? (
              <StatusNotice tone="loading" title="Loading projects" />
            ) : loadFailed ? (
              <LoadError message="Could not load your projects. Check your connection and try again." onRetry={() => setLoadAttempt((n) => n + 1)} />
            ) : (
              <StatusNotice tone="empty" title={query ? 'No projects match these filters.' : 'No projects yet.'} />
            )}
          </div>
        )}
      </Panel>

      <CustomModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete project"
        maxWidth="420px"
        minHeight="auto"
      >
        <p className="po-modal-text">
          Are you sure you want to delete <strong>{deleteTarget?.title}</strong>? This action cannot be undone.
        </p>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={() => setDeleteTarget(null)} />
          <CustomButton text="Delete" variant="danger" onClick={confirmDelete} />
        </div>
      </CustomModal>
    </Page>
  );
};

export default ProjectsOverview;
