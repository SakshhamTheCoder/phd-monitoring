import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatDate } from '../../utils/timeParse';
import { apiAddPosition, apiUpdatePosition, apiDeletePosition, apiSetApplicationStatus } from '../../api/projects';
import { useView } from '../../api/views';
import { storedFileUrl, storedFileClick } from '../../api/fileAccess';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import { toast } from 'react-toastify';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import useDoneFlash from '../../hooks/useDoneFlash';
import './ProjectRecruitment.css';

const Badge = ({ badge }) => <span className={`badge badge--${badge.tone}`}>{badge.text}</span>;

const emptyPos = {
  type: '', title: '', openings: 1, status: 'Open', eligibility: '', skills: '',
  cgpa: '', stipend: '', deadline: '', description: '',
  advertisementFile: null, advertisementName: '',
};

// The post-opening form as the position endpoint takes it.
const toPositionBody = (f) => ({
  type: f.type, title: f.title, openings: Number(f.openings) || 1,
  status: f.status || 'Open',
  stipend: f.stipend || '', deadline: f.deadline || null,
  eligibility: f.eligibility || '', skills: f.skills || '',
  min_cgpa: f.cgpa || '', description: f.description || '',
});

// The advertisement is a file, so the whole body has to go up as multipart.
const toPositionForm = (f) => {
  const fd = new FormData();
  // Blanks go up as '' so a cleared field is saved cleared; the server's
  // empty-string middleware stores them as null.
  Object.entries(toPositionBody(f)).forEach(([key, value]) => fd.append(key, value ?? ''));
  fd.append('advertisement', f.advertisementFile);
  return fd;
};

/**
 * A project's recruitment (GET /views/project-recruitment, server:
 * App\Pages\ProjectRecruitmentPage): its positions and, for the PI, the
 * applications to each, every figure and decision the server's. Posting,
 * closing and deciding go to the endpoints, and the page is read again.
 */
const Recruitment = ({ view, reload }) => {
  const navigate = useNavigate();
  const [publishing, setPublishing] = useState(false);
  // Held by id, so each answer from the server shows the same position and applicant.
  const [selectedPositionId, setSelectedPositionId] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPosIdx, setEditingPosIdx] = useState(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState(null);
  const [posForm, setPosForm] = useState(emptyPos);
  const adRef = useRef(null);
  const [decided, flashDecided] = useDoneFlash();
  const { positions, applications } = view;
  const canEdit = view.can_edit;
  const selectedPosition = positions.find((p) => p.id === selectedPositionId) || null;
  const selectedApplicant = applications.find((a) => a.id === selectedApplicantId) || null;

  const handleAdvertisement = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setPosForm((prev) => ({ ...prev, advertisementFile: file, advertisementName: file.name }));
  };

  // Applications for the currently-opened position.
  const posApps = selectedPosition ? applications.filter((a) => a.position_id === selectedPosition.id) : [];
  const appStats = {
    total: posApps.length,
    shortlisted: posApps.filter((a) => a.status === 'Shortlisted').length,
    interview: posApps.filter((a) => a.status === 'Interview Scheduled').length,
    selected: posApps.filter((a) => a.status === 'Selected').length,
  };

  // ---- Position CRUD ----
  const clearAdInput = () => { if (adRef.current) adRef.current.value = ''; };
  const openAddPos = () => { setSelectedPositionId(null); setEditingPosIdx(null); setPosForm(emptyPos); clearAdInput(); setShowPostForm(true); };
  const openEditPos = (i) => {
    setEditingPosIdx(i);
    setPosForm({ ...emptyPos, ...positions[i].form });
    clearAdInput();
    setShowPostForm(true);
  };
  const closePostForm = () => { setShowPostForm(false); setEditingPosIdx(null); setPosForm(emptyPos); clearAdInput(); };
  const publishPosition = async () => {
    if (!posForm.type) { toast.error('Please select a position type.'); return; }
    if (!posForm.title.trim()) { toast.error('Position title is required.'); return; }
    // A second click while the first was on its way published the opening twice.
    if (publishing) return;
    setPublishing(true);
    const body = posForm.advertisementFile ? toPositionForm(posForm) : toPositionBody(posForm);
    const res = editingPosIdx !== null
      ? await apiUpdatePosition(view.id, positions[editingPosIdx].id, body)
      : await apiAddPosition(view.id, body);
    setPublishing(false);
    if (res.success) {
      toast.success(editingPosIdx !== null ? 'Position updated.' : 'Position published.');
      closePostForm();
      reload();
    }
  };
  const togglePositionStatus = async (i) => {
    const { toggle } = positions[i];
    const res = await apiUpdatePosition(view.id, positions[i].id, { status: toggle.status });
    if (res.success) {
      toast.success(toggle.done);
      reload();
    }
  };

  const deletePosition = async (i) => {
    if (!window.confirm(positions[i].delete)) return;
    const res = await apiDeletePosition(view.id, positions[i].id);
    if (res.success) { toast.success('Position deleted.'); reload(); }
  };

  // ---- Application decisions ----
  const setAppStatus = async (newStatus) => {
    const res = await apiSetApplicationStatus(selectedApplicant.id, newStatus);
    if (res.success) {
      flashDecided();
      toast.success(`Marked as ${newStatus}.`);
      reload();
    }
  };

  const required = <span className="req" aria-hidden="true">*</span>;

  return (
    <>
      <button type="button" className="page-back-link pr-back" onClick={() => navigate(view.back.path)}>
        <i className="fa fa-arrow-left" aria-hidden="true"></i> {view.back.label}
      </button>
      <Page
        className={view.page_class}
        title={view.title}
        description={view.description}
        actions={canEdit && (
          // While the form is open its Publish is the filled button.
          <CustomButton text={view.post} variant={showPostForm ? 'secondary' : undefined} onClick={() => (showPostForm ? closePostForm() : openAddPos())} />
        )}
      >
        {/* Post / Edit Opening Form */}
        {showPostForm && (
          <Panel title={editingPosIdx !== null ? 'Edit opening' : 'Post new opening'}>
            <div className="pr-form-grid">
              <div className="pr-field">
                <label htmlFor="project-recruitment-position-type">Position type {required}</label>
                <select id="project-recruitment-position-type" aria-required="true" value={posForm.type} onChange={(e) => setPosForm({ ...posForm, type: e.target.value })}>
                  <option value="">Select type</option>
                  {view.position_types.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="pr-field">
                <label htmlFor="project-recruitment-position-title">Position title {required}</label>
                <input id="project-recruitment-position-title" type="text" aria-required="true" value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} placeholder="e.g. Junior Research Fellow, NAS Project" />
              </div>
              <div className="pr-field"><label htmlFor="project-recruitment-number-of-openings">Number of openings</label><input id="project-recruitment-number-of-openings" type="number" min="1" value={posForm.openings} onChange={(e) => setPosForm({ ...posForm, openings: e.target.value })} /></div>
              <div className="pr-field">
                <label htmlFor="project-recruitment-status">Status</label>
                <select id="project-recruitment-status" value={posForm.status} onChange={(e) => setPosForm({ ...posForm, status: e.target.value })}>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="pr-field"><label htmlFor="project-recruitment-eligibility">Eligibility</label><input id="project-recruitment-eligibility" type="text" value={posForm.eligibility} onChange={(e) => setPosForm({ ...posForm, eligibility: e.target.value })} placeholder="e.g. M.Tech in CS/ECE" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-required-skills">Required skills</label><input id="project-recruitment-required-skills" type="text" value={posForm.skills} onChange={(e) => setPosForm({ ...posForm, skills: e.target.value })} placeholder="e.g. Python, PyTorch, ML" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-min-cgpa">Min CGPA</label><input id="project-recruitment-min-cgpa" type="text" value={posForm.cgpa} onChange={(e) => setPosForm({ ...posForm, cgpa: e.target.value })} placeholder="e.g. 7.5" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-stipend">Stipend</label><input id="project-recruitment-stipend" type="text" value={posForm.stipend} onChange={(e) => setPosForm({ ...posForm, stipend: e.target.value })} placeholder="e.g. ₹31,000/month" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-application-deadline">Application deadline</label><input id="project-recruitment-application-deadline" type="date" value={posForm.deadline} onChange={(e) => setPosForm({ ...posForm, deadline: e.target.value })} /></div>
              <div className="pr-field">
                <label htmlFor="project-recruitment-advertisement-pdf">Advertisement PDF</label>
                <input id="project-recruitment-advertisement-pdf" type="file" accept=".pdf" ref={adRef} onChange={handleAdvertisement} />
                {posForm.advertisementName
                  ? <span className="pr-field-hint"><i className="fa fa-paperclip" aria-hidden="true"></i> {posForm.advertisementName}</span>
                  : posForm.advertisementPath && <a className="pr-field-hint" href={storedFileUrl(posForm.advertisementPath)} target="_blank" rel="noopener noreferrer" onClick={storedFileClick(posForm.advertisementPath)}><i className="fa fa-file-pdf-o" aria-hidden="true"></i> Current advertisement</a>}
              </div>
              <div className="pr-field full"><label htmlFor="project-recruitment-job-description">Job description</label><textarea id="project-recruitment-job-description" rows="4" value={posForm.description} onChange={(e) => setPosForm({ ...posForm, description: e.target.value })} placeholder="Describe the role, responsibilities, and what the candidate will work on. This is shown to students on the Openings portal." /></div>
            </div>
            <div className="pr-form-actions">
              <CustomButton text={editingPosIdx !== null ? 'Save changes' : 'Publish opening'} onClick={publishPosition} busy={publishing} />
              <CustomButton text="Cancel" variant="quiet" onClick={closePostForm} />
            </div>
          </Panel>
        )}

        {/* Open positions: open one to see its applications */}
        {!selectedPosition && !showPostForm && (
          <Panel title="Open positions">
            {positions.length > 0 ? (
              positions.map((pos, i) => (
                // Applications are PI only server side, so for anyone else the
                // row is the whole story and opening it would show an empty list.
                <div
                  key={i}
                  className={`panel-section pr-position${canEdit ? ' pr-position-clickable' : ''}`}
                  onClick={canEdit ? () => setSelectedPositionId(pos.id) : undefined}
                  onKeyDown={canEdit ? (e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPositionId(pos.id); }
                  } : undefined}
                  role={canEdit ? 'button' : undefined}
                  tabIndex={canEdit ? 0 : undefined}
                >
                  <div className="pr-pos-top">
                    <div>
                      <span className="badge badge--accent">{pos.type}</span>
                      <h3 className="pr-pos-title">{pos.title}</h3>
                    </div>
                    <div className="pr-pos-top-right">
                      <Badge badge={pos.badge} />
                      <span className="pr-pos-deadline"><i className="fa fa-calendar" aria-hidden="true"></i> Deadline: {formatDate(pos.deadline)}</span>
                      {canEdit && (
                        <div className="pr-pos-actions">
                          <button type="button" className="pr-icon-btn" onClick={(e) => { e.stopPropagation(); togglePositionStatus(i); }} title={pos.toggle.label} aria-label={pos.toggle.label}>
                            <i className={`fa ${pos.toggle.icon}`} aria-hidden="true"></i>
                          </button>
                          <button type="button" className="pr-icon-btn" onClick={(e) => { e.stopPropagation(); openEditPos(i); }} title="Edit position" aria-label="Edit position"><i className="fa fa-pencil" aria-hidden="true"></i></button>
                          <button type="button" className="pr-icon-btn danger" onClick={(e) => { e.stopPropagation(); deletePosition(i); }} title="Delete position" aria-label="Delete position"><i className="fa fa-trash" aria-hidden="true"></i></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <dl className="facts pr-pos-stats">
                    {pos.stats.map((stat) => (
                      <div key={stat.label}><dt>{stat.label}</dt><dd>{stat.value.map((part, index) => <React.Fragment key={index}>{part}</React.Fragment>)}</dd></div>
                    ))}
                  </dl>
                  {canEdit && (
                    <div className="pr-pos-view-hint">View applications <i className="fa fa-arrow-right" aria-hidden="true"></i></div>
                  )}
                </div>
              ))
            ) : (
              <StatusNotice tone="empty" title={view.none.title}>
                {view.none.hint}
              </StatusNotice>
            )}
          </Panel>
        )}

        {/* Applications for the opened position */}
        {selectedPosition && (
          <Panel
            flush
            title={`Applications: ${selectedPosition.title}`}
            actions={<CustomButton text="Back to positions" variant="quiet" size="sm" onClick={() => setSelectedPositionId(null)} />}
          >
            <dl className="facts pr-app-stats">
              <div><dt>Total applications</dt><dd>{appStats.total}</dd></div>
              <div><dt>Shortlisted</dt><dd>{appStats.shortlisted}</dd></div>
              <div><dt>Interview scheduled</dt><dd>{appStats.interview}</dd></div>
              <div><dt>Selected</dt><dd>{appStats.selected}</dd></div>
            </dl>
            {posApps.length > 0 ? (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr><th>Applicant name</th><th>Institute</th><th>CGPA</th><th>Status</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {posApps.map((app) => (
                      <tr key={app.id}>
                        <td>
                          {app.name}
                          {app.unconfirmed && <span className="badge badge--neutral pr-app-flag">{app.unconfirmed}</span>}
                        </td>
                        <td>{app.institute}</td>
                        <td>{app.cgpa}</td>
                        <td><Badge badge={app.badge} /></td>
                        <td>
                          <CustomButton text="View" variant="quiet" size="sm" onClick={() => setSelectedApplicantId(app.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="pr-state">
                <StatusNotice tone="empty" title="No applications for this position yet." />
              </div>
            )}
          </Panel>
        )}

        {/* Applicant Detail Modal */}
        <CustomModal
          isOpen={!!selectedApplicant}
          onClose={() => setSelectedApplicantId(null)}
          maxWidth="520px"
          minHeight="auto"
        >
          {selectedApplicant && (
            <>
              <div className="pr-modal-header">
                <div className="pr-modal-avatar" aria-hidden="true">{selectedApplicant.initials}</div>
                <div>
                  <h2 className="pr-modal-name">{selectedApplicant.name}</h2>
                  <p>{selectedApplicant.degree} · {selectedApplicant.institute}</p>
                  {/* Keyed so a new decision remounts the badge and replays its pop. */}
                  <span key={selectedApplicant.status} className={`badge badge--${selectedApplicant.badge.tone}`}>{selectedApplicant.status}</span>
                </div>
              </div>
              <dl className="facts pr-modal-facts">
                {selectedApplicant.facts.map((fact) => (
                  <div key={fact.label} className={fact.full ? 'full' : undefined}>
                    <dt>{fact.label}</dt>
                    <dd className={fact.class}>{'date' in fact ? formatDate(fact.date) : fact.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="pr-modal-resume">
                <div className="pr-resume-info"><i className="fa fa-file-pdf-o" aria-hidden="true"></i> <span>{selectedApplicant.resume ? selectedApplicant.resume.name : 'No resume attached'}</span></div>
                {selectedApplicant.resume && (
                  <div className="pr-resume-btns">
                    <a className="custom-button custom-button--secondary custom-button--sm" href={storedFileUrl(selectedApplicant.resume.path)} target="_blank" rel="noopener noreferrer" onClick={storedFileClick(selectedApplicant.resume.path)}>View resume</a>
                    <a className="custom-button custom-button--quiet custom-button--sm" href={storedFileUrl(selectedApplicant.resume.path)} download target="_blank" rel="noopener noreferrer" onClick={storedFileClick(selectedApplicant.resume.path, { download: true })}>Download</a>
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="modal-actions pr-decisions">
                  {/* The applicant's status is now the decision just made, so it
                      names the button to check. */}
                  {view.decisions.map((decision) => (
                    <CustomButton
                      key={decision.status}
                      text={decision.label}
                      variant={decision.variant}
                      size="sm"
                      done={decided && selectedApplicant.status === decision.status}
                      onClick={() => setAppStatus(decision.status)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CustomModal>
      </Page>
    </>
  );
};

const ProjectRecruitment = () => {
  const { id } = useParams();
  const { view, failed, retry, reload } = useView('project-recruitment', { id }, { kept: false });

  if (failed) {
    return <LoadError message="Could not load this project's recruitment. Check your connection and try again." onRetry={retry} />;
  }
  if (!view) return <StatusNotice tone="loading" title="Loading recruitment" />;
  if (!view.id) return <StatusNotice tone="empty" title="Project not found." />;
  // Another project starts clean, so the last one's open forms neither show nor save here.
  return <Recruitment key={id} view={view} reload={reload} />;
};

export default ProjectRecruitment;
