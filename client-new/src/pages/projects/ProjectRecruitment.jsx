import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { positionTypes } from '../../data/projectsData';
import { formatDate, EMPTY_VALUE } from '../../utils/timeParse';
import { badgeClass } from '../../data/badges';
import { apiGetProject, apiListPositions, apiAddPosition, apiUpdatePosition, apiDeletePosition, apiListApplications, apiSetApplicationStatus, fileUrl } from '../../api/projects';
import CustomModal from '../../components/forms/modal/CustomModal';
import CustomButton from '../../components/forms/fields/CustomButton';
import { toast } from 'react-toastify';
import LoadError from '../../components/common/LoadError';
import StatusNotice from '../../components/common/StatusNotice';
import Page from '../../components/page/Page';
import Panel from '../../components/panel/Panel';
import useDoneFlash from '../../hooks/useDoneFlash';
import './ProjectRecruitment.css';

const emptyPos = {
  type: '', title: '', openings: 1, status: 'Open', eligibility: '', skills: '',
  cgpa: '', stipend: '', deadline: '', description: '',
  advertisementFile: null, advertisementName: '',
};

// Map the post-opening form to the backend position body.
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

const ProjectRecruitment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [showPostForm, setShowPostForm] = useState(false);
  const [editingPosIdx, setEditingPosIdx] = useState(null);
  const [selectedApplicant, setSelectedApplicant] = useState(null);
  const [posForm, setPosForm] = useState(emptyPos);
  const [positions, setPositions] = useState([]);
  const [applications, setApplications] = useState([]);
  const adRef = useRef(null);
  const [decided, flashDecided] = useDoneFlash();

  const handleAdvertisement = (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) setPosForm(prev => ({ ...prev, advertisementFile: file, advertisementName: file.name }));
  };

  useEffect(() => {
    let cancelled = false;
    // Another project starts clean, so the last one's positions and open
    // forms neither show nor save under this id.
    setLoading(true);
    setLoadFailed(false);
    setProject(null);
    setSelectedPosition(null);
    setShowPostForm(false);
    setEditingPosIdx(null);
    setSelectedApplicant(null);
    setPosForm(emptyPos);
    Promise.all([apiGetProject(id), apiListPositions(id), apiListApplications(id)]).then(([{ project: p, failed }, pos, apps]) => {
      if (cancelled) return;
      setProject(p); setLoadFailed(failed); setPositions(pos); setApplications(apps); setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id, loadAttempt]);

  if (loading) {
    return <StatusNotice tone="loading" title="Loading recruitment" />;
  }
  if (loadFailed) {
    return <LoadError message="Could not load this project's recruitment. Check your connection and try again." onRetry={() => setLoadAttempt((n) => n + 1)} />;
  }
  if (!project) {
    return <StatusNotice tone="empty" title="Project not found." />;
  }

  const canEdit = project.canEdit;

  // Applications for the currently-opened position.
  const posApps = selectedPosition ? applications.filter(a => a.posKey === selectedPosition.id) : [];
  const appStats = {
    total: posApps.length,
    shortlisted: posApps.filter(a => a.status === 'Shortlisted').length,
    interview: posApps.filter(a => a.status === 'Interview Scheduled').length,
    selected: posApps.filter(a => a.status === 'Selected').length,
  };

  // ---- Position CRUD ----
  const clearAdInput = () => { if (adRef.current) adRef.current.value = ''; };
  const openAddPos = () => { setSelectedPosition(null); setEditingPosIdx(null); setPosForm(emptyPos); clearAdInput(); setShowPostForm(true); };
  const openEditPos = (i) => {
    setEditingPosIdx(i);
    setPosForm({ ...emptyPos, ...positions[i] });
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
      ? await apiUpdatePosition(project.id, positions[editingPosIdx].id, body)
      : await apiAddPosition(project.id, body);
    setPublishing(false);
    if (res.success) {
      setPositions(await apiListPositions(project.id));
      toast.success(editingPosIdx !== null ? 'Position updated.' : 'Position published.');
      closePostForm();
    }
  };
  const togglePositionStatus = async (i) => {
    const pos = positions[i];
    const status = pos.status === 'Closed' ? 'Open' : 'Closed';
    const res = await apiUpdatePosition(project.id, pos.id, { status });
    if (res.success) {
      setPositions(prev => prev.map((p, idx) => (idx === i ? { ...p, status } : p)));
      toast.success(status === 'Closed' ? 'Position closed to new applications.' : 'Position reopened.');
    }
  };

  const deletePosition = async (i) => {
    const pos = positions[i];
    const count = pos.applicants ?? 0;
    const apps = count ? ` and its ${count === 1 ? '1 application' : `${count} applications`}` : '';
    if (!window.confirm(`Delete the position "${pos.title}"${apps}? This cannot be undone.`)) return;
    const res = await apiDeletePosition(project.id, positions[i].id);
    if (res.success) { setPositions(prev => prev.filter((_, idx) => idx !== i)); toast.success('Position deleted.'); }
  };

  // ---- Application decisions ----
  const setAppStatus = async (newStatus) => {
    const res = await apiSetApplicationStatus(selectedApplicant.id, newStatus);
    if (res.success) {
      setApplications(prev => prev.map(a => (a.id === selectedApplicant.id ? { ...a, status: newStatus } : a)));
      setSelectedApplicant({ ...selectedApplicant, status: newStatus });
      flashDecided();
      toast.success(`Marked as ${newStatus}.`);
    }
  };

  const required = <span className="req" aria-hidden="true">*</span>;

  return (
    <>
      <button type="button" className="page-back-link pr-back" onClick={() => navigate(`/projects/${id}`)}>
        <i className="fa fa-arrow-left" aria-hidden="true"></i> Back to project
      </button>
      <Page
        className="reveal"
        title={`Recruitment: ${project.title.length > 50 ? project.title.slice(0, 50) + '...' : project.title}`}
        description="Manage positions and applications for this project."
        actions={canEdit && (
          // While the form is open its Publish is the filled button.
          <CustomButton text="Post opening" variant={showPostForm ? 'secondary' : undefined} onClick={() => (showPostForm ? closePostForm() : openAddPos())} />
        )}
      >
        {/* Post / Edit Opening Form */}
        {showPostForm && (
          <Panel title={editingPosIdx !== null ? 'Edit opening' : 'Post new opening'}>
            <div className="pr-form-grid">
              <div className="pr-field">
                <label htmlFor="project-recruitment-position-type">Position type {required}</label>
                <select id="project-recruitment-position-type" aria-required="true" value={posForm.type} onChange={e => setPosForm({...posForm, type: e.target.value})}>
                  <option value="">Select type</option>
                  {positionTypes.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="pr-field">
                <label htmlFor="project-recruitment-position-title">Position title {required}</label>
                <input id="project-recruitment-position-title" type="text" aria-required="true" value={posForm.title} onChange={e => setPosForm({...posForm, title: e.target.value})} placeholder="e.g. Junior Research Fellow, NAS Project" />
              </div>
              <div className="pr-field"><label htmlFor="project-recruitment-number-of-openings">Number of openings</label><input id="project-recruitment-number-of-openings" type="number" min="1" value={posForm.openings} onChange={e => setPosForm({...posForm, openings: e.target.value})} /></div>
              <div className="pr-field">
                <label htmlFor="project-recruitment-status">Status</label>
                <select id="project-recruitment-status" value={posForm.status} onChange={e => setPosForm({...posForm, status: e.target.value})}>
                  <option value="Open">Open</option>
                  <option value="Closed">Closed</option>
                </select>
              </div>
              <div className="pr-field"><label htmlFor="project-recruitment-eligibility">Eligibility</label><input id="project-recruitment-eligibility" type="text" value={posForm.eligibility} onChange={e => setPosForm({...posForm, eligibility: e.target.value})} placeholder="e.g. M.Tech in CS/ECE" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-required-skills">Required skills</label><input id="project-recruitment-required-skills" type="text" value={posForm.skills} onChange={e => setPosForm({...posForm, skills: e.target.value})} placeholder="e.g. Python, PyTorch, ML" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-min-cgpa">Min CGPA</label><input id="project-recruitment-min-cgpa" type="text" value={posForm.cgpa} onChange={e => setPosForm({...posForm, cgpa: e.target.value})} placeholder="e.g. 7.5" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-stipend">Stipend</label><input id="project-recruitment-stipend" type="text" value={posForm.stipend} onChange={e => setPosForm({...posForm, stipend: e.target.value})} placeholder="e.g. ₹31,000/month" /></div>
              <div className="pr-field"><label htmlFor="project-recruitment-application-deadline">Application deadline</label><input id="project-recruitment-application-deadline" type="date" value={posForm.deadline} onChange={e => setPosForm({...posForm, deadline: e.target.value})} /></div>
              <div className="pr-field">
                <label htmlFor="project-recruitment-advertisement-pdf">Advertisement PDF</label>
                <input id="project-recruitment-advertisement-pdf" type="file" accept=".pdf" ref={adRef} onChange={handleAdvertisement} />
                {posForm.advertisementName
                  ? <span className="pr-field-hint"><i className="fa fa-paperclip" aria-hidden="true"></i> {posForm.advertisementName}</span>
                  : posForm.advertisementPath && <a className="pr-field-hint" href={fileUrl(posForm.advertisementPath)} target="_blank" rel="noopener noreferrer"><i className="fa fa-file-pdf-o" aria-hidden="true"></i> Current advertisement</a>}
              </div>
              <div className="pr-field full"><label htmlFor="project-recruitment-job-description">Job description</label><textarea id="project-recruitment-job-description" rows="4" value={posForm.description} onChange={e => setPosForm({...posForm, description: e.target.value})} placeholder="Describe the role, responsibilities, and what the candidate will work on. This is shown to students on the Openings portal." /></div>
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
                  onClick={canEdit ? () => setSelectedPosition(pos) : undefined}
                  onKeyDown={canEdit ? (e) => {
                    if (e.target !== e.currentTarget) return;
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPosition(pos); }
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
                      <span className={badgeClass(pos.status)}>{pos.status}</span>
                      <span className="pr-pos-deadline"><i className="fa fa-calendar" aria-hidden="true"></i> Deadline: {formatDate(pos.deadline)}</span>
                      {canEdit && (
                        <div className="pr-pos-actions">
                          <button type="button" className="pr-icon-btn" onClick={(e) => { e.stopPropagation(); togglePositionStatus(i); }} title={pos.status === 'Closed' ? 'Reopen position' : 'Close position'} aria-label={pos.status === 'Closed' ? 'Reopen position' : 'Close position'}>
                            <i className={`fa ${pos.status === 'Closed' ? 'fa-unlock' : 'fa-lock'}`} aria-hidden="true"></i>
                          </button>
                          <button type="button" className="pr-icon-btn" onClick={(e) => { e.stopPropagation(); openEditPos(i); }} title="Edit position" aria-label="Edit position"><i className="fa fa-pencil" aria-hidden="true"></i></button>
                          <button type="button" className="pr-icon-btn danger" onClick={(e) => { e.stopPropagation(); deletePosition(i); }} title="Delete position" aria-label="Delete position"><i className="fa fa-trash" aria-hidden="true"></i></button>
                        </div>
                      )}
                    </div>
                  </div>
                  <dl className="facts pr-pos-stats">
                    <div><dt>Filled</dt><dd>{pos.selected ?? 0} / {pos.openings}</dd></div>
                    <div><dt>Stipend</dt><dd>{pos.stipend || EMPTY_VALUE}</dd></div>
                    <div><dt>Applicants</dt><dd>{pos.applicants ?? 0}</dd></div>
                    <div><dt>Shortlisted</dt><dd>{pos.shortlisted ?? 0}</dd></div>
                  </dl>
                  {canEdit && (
                    <div className="pr-pos-view-hint">View applications <i className="fa fa-arrow-right" aria-hidden="true"></i></div>
                  )}
                </div>
              ))
            ) : (
              <StatusNotice tone="empty" title="No positions posted yet.">
                {canEdit ? 'Click "Post opening" to create one.' : null}
              </StatusNotice>
            )}
          </Panel>
        )}

        {/* Applications for the opened position */}
        {selectedPosition && (
          <Panel
            flush
            title={`Applications: ${selectedPosition.title}`}
            actions={<CustomButton text="Back to positions" variant="quiet" size="sm" onClick={() => setSelectedPosition(null)} />}
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
                    {posApps.map(app => (
                      <tr key={app.id}>
                        <td>
                          {app.name}
                          {!app.verified && <span className="badge badge--neutral pr-app-flag">Unconfirmed email</span>}
                        </td>
                        <td>{app.institute}</td>
                        <td>{app.cgpa}</td>
                        <td>
                          <span className={badgeClass(app.status)}>{app.status}</span>
                        </td>
                        <td>
                          <CustomButton text="View" variant="quiet" size="sm" onClick={() => setSelectedApplicant(app)} />
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
          onClose={() => setSelectedApplicant(null)}
          maxWidth="520px"
          minHeight="auto"
        >
          {selectedApplicant && (
            <>
              <div className="pr-modal-header">
                <div className="pr-modal-avatar" aria-hidden="true">{selectedApplicant.name.split(' ').map(n => n[0]).join('')}</div>
                <div>
                  <h2 className="pr-modal-name">{selectedApplicant.name}</h2>
                  <p>{selectedApplicant.degree} · {selectedApplicant.institute}</p>
                  {/* Keyed so a new decision remounts the badge and replays its pop. */}
                  <span key={selectedApplicant.status} className={badgeClass(selectedApplicant.status)}>{selectedApplicant.status}</span>
                </div>
              </div>
              <dl className="facts pr-modal-facts">
                <div><dt>Email</dt><dd>{selectedApplicant.email || EMPTY_VALUE}</dd></div>
                <div><dt>Phone</dt><dd>{selectedApplicant.phone || EMPTY_VALUE}</dd></div>
                <div><dt>Applied for</dt><dd>{selectedApplicant.position}</dd></div>
                <div><dt>CGPA</dt><dd>{selectedApplicant.cgpa}</dd></div>
                <div><dt>Degree</dt><dd>{selectedApplicant.degree}</dd></div>
                <div><dt>Institute</dt><dd>{selectedApplicant.institute}</dd></div>
                <div><dt>Applied on</dt><dd>{formatDate(selectedApplicant.appliedDate)}</dd></div>
                <div className="full"><dt>Research interest</dt><dd>{selectedApplicant.research}</dd></div>
                <div className="full"><dt>Skills</dt><dd>{(selectedApplicant.skills || []).join(', ')}</dd></div>
                {selectedApplicant.coverNote && <div className="full"><dt>Cover note</dt><dd className="pr-cover-note">{selectedApplicant.coverNote}</dd></div>}
              </dl>
              <div className="pr-modal-resume">
                <div className="pr-resume-info"><i className="fa fa-file-pdf-o" aria-hidden="true"></i> <span>{selectedApplicant.resume || 'No resume attached'}</span></div>
                {selectedApplicant.resume && (
                  <div className="pr-resume-btns">
                    <a className="custom-button custom-button--secondary custom-button--sm" href={selectedApplicant.resumeUrl} target="_blank" rel="noopener noreferrer">View resume</a>
                    <a className="custom-button custom-button--quiet custom-button--sm" href={selectedApplicant.resumeUrl} download target="_blank" rel="noopener noreferrer">Download</a>
                  </div>
                )}
              </div>
              {canEdit && (
                <div className="modal-actions pr-decisions">
                  {/* The applicant's status is now the decision just made, so it
                      names the button to check. */}
                  <CustomButton text="Shortlist" variant="secondary" size="sm" done={decided && selectedApplicant.status === 'Shortlisted'} onClick={() => setAppStatus('Shortlisted')} />
                  <CustomButton text="Interview" variant="secondary" size="sm" done={decided && selectedApplicant.status === 'Interview Scheduled'} onClick={() => setAppStatus('Interview Scheduled')} />
                  <CustomButton text="Select" variant="success" size="sm" done={decided && selectedApplicant.status === 'Selected'} onClick={() => setAppStatus('Selected')} />
                  <CustomButton text="Reject" variant="danger-outline" size="sm" done={decided && selectedApplicant.status === 'Rejected'} onClick={() => setAppStatus('Rejected')} />
                </div>
              )}
            </>
          )}
        </CustomModal>
      </Page>
    </>
  );
};

export default ProjectRecruitment;
