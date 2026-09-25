import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { fillFromRow, useView } from '../../api/views';
import { sendRequest } from '../../components/serverPage/requests';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import FilterBar from '../../components/filterBar/FilterBar';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import StatusNotice from '../../components/common/StatusNotice';
import LoadError from '../../components/common/LoadError';
import useDoneFlash from '../../hooks/useDoneFlash';
import './ProjectsOverview.css';

const Badge = ({ badge }) => <span className={`badge badge--${badge.tone}`}>{badge.text}</span>;

// A CSV of the rows the server named for export.
const downloadCsv = (fileName, { headers, rows }) => {
  const csvContent = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * The projects overview (GET /views/projects, server: App\Pages\ProjectsPage):
 * the page is described once and kept, and its figures and rows come from
 * GET /projects/overview with every value phrased, so a search asks for rows
 * only.
 */
const ProjectsOverview = () => {
  const navigate = useNavigate();
  const { view } = useView('projects');
  const [query, setQuery] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exported, flashExported] = useDoneFlash();

  useEffect(() => {
    // A slower answer to an older search must not overwrite the current one.
    let cancelled = false;
    const qs = query ? `?filters=${encodeURIComponent(JSON.stringify(query))}` : '';
    customFetch(`${baseURL}/projects/overview${qs}`, 'GET', {}, false).then((res) => {
      if (cancelled) return;
      if (res.success) setData(res.response);
      setLoadFailed(!res.success);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [query, loadAttempt]);

  if (!view) return null;
  const rows = data?.rows || [];
  const facts = data?.facts || view.facts || [];
  const remove = view.dialogs.delete;

  const confirmDelete = async () => {
    const target = deleteTarget;
    setDeleteTarget(null);
    if (await sendRequest(remove.request, target, {}, () => {})) setLoadAttempt((n) => n + 1);
  };

  const runAction = (action) => {
    if (action.navigate) navigate(action.navigate);
    else if (action.exports && data) {
      downloadCsv(action.exports, data.export);
      flashExported();
    }
  };

  return (
    <Page
      title={view.title}
      description={view.description}
      actions={<>
        {view.actions.map((action) => (
          <CustomButton
            key={action.label}
            text={action.label}
            variant={action.variant}
            done={action.exports ? exported : undefined}
            onClick={() => runAction(action)}
          />
        ))}
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
        {/* Drawn as the head PagenationTable gives its search, so this list
            reads the same as the server paged ones. */}
        <div className="panel-head">
          <div className="table-search po-search">
            <FilterBar onSearch={(q) => { setLoading(true); setQuery(q); }} />
          </div>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {view.columns.map((column) => <th key={column}>{column}</th>)}
                <th><span className="sr-only">Actions</span></th>
                <th><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((project) => {
                const opens = fillFromRow(view.row.opens, project);
                return (
                  <tr
                    key={project.id}
                    // reveal: a row arriving (first load, a new search) fades in.
                    className="row-link reveal"
                    tabIndex={0}
                    onClick={() => navigate(opens)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(opens)}
                  >
                    <td>
                      <div className="po-project-title">{project.title}</div>
                    </td>
                    <td><Badge badge={project.category} /></td>
                    <td>{project.role}</td>
                    <td>{project.agency}</td>
                    <td>{project.amount}</td>
                    <td>{project.duration}</td>
                    <td><Badge badge={project.status} /></td>
                    <td>
                      <div className="po-action-buttons">
                        {project.can_edit ? (
                          <>
                            <button
                              type="button"
                              className="po-icon-btn"
                              title={view.row.edit}
                              aria-label={view.row.edit}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate('/projects/create', { state: { editProject: { id: project.id } } });
                              }}
                            >
                              <i className="fa fa-pencil" aria-hidden="true"></i>
                            </button>
                            <button
                              type="button"
                              className="po-icon-btn delete"
                              title={view.row.delete}
                              aria-label={view.row.delete}
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteTarget(project);
                              }}
                            >
                              <i className="fa fa-trash" aria-hidden="true"></i>
                            </button>
                          </>
                        ) : (
                          <span className="po-readonly">{view.row.read_only}</span>
                        )}
                      </div>
                    </td>
                    <td className="row-go" title={view.row.open}><i className="fa fa-angle-right" aria-hidden="true"></i></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {(loading || loadFailed || rows.length === 0) && (
          <div className="po-state">
            {loading ? (
              <StatusNotice tone="loading" title={view.states.loading} />
            ) : loadFailed ? (
              <LoadError message={view.states.failed} onRetry={() => setLoadAttempt((n) => n + 1)} />
            ) : (
              <StatusNotice tone="empty" title={query ? view.states.no_match : view.states.empty} />
            )}
          </div>
        )}
      </Panel>

      <CustomModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={remove.title}
        maxWidth="420px"
        minHeight="auto"
      >
        <p className="po-modal-text">
          {remove.text.map((part, index) => (
            <React.Fragment key={index}>{typeof part === 'string' ? part : <strong>{fillFromRow(part.strong, deleteTarget)}</strong>}</React.Fragment>
          ))}
        </p>
        <div className="modal-actions">
          <CustomButton text="Cancel" variant="quiet" onClick={() => setDeleteTarget(null)} />
          <CustomButton text={remove.button} variant="danger" onClick={confirmDelete} />
        </div>
      </CustomModal>
    </Page>
  );
};

export default ProjectsOverview;
