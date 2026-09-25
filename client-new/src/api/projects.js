// API layer for the Projects module. Wraps customFetch and maps between the
// backend's snake_case shape and the camelCase shape the React pages expect.
import { baseURL } from './urls';
import { customFetch } from './base';

// ---- mappers: backend -> frontend ----
export const mapMilestone = (m) => ({
  id: m.id, name: m.name, deliverable: m.deliverable, dueDate: m.due_date, status: m.status,
});
export const mapDocument = (d) => ({
  id: d.id, name: d.name, type: d.type, date: d.doc_date,
  // A stored file or an external link; open it with openStoredFile.
  url: d.file_path || d.link, file_path: d.file_path, link: d.link,
});
export const mapPosition = (p) => ({
  id: p.id, type: p.type, title: p.title, openings: p.openings, stipend: p.stipend,
  status: p.status || 'Open',
  deadline: p.deadline, eligibility: p.eligibility, skills: p.skills, cgpa: p.min_cgpa,
  description: p.description, advertisementPath: p.advertisement_path,
  applicants: p.applications_count ?? p.applicants ?? 0,
  shortlisted: p.shortlisted_count ?? p.shortlisted ?? 0,
  selected: p.selected_count ?? p.selected ?? 0,
  projectId: p.project_id, projectTitle: p.project ? p.project.title : p.project_title,
  posKey: p.id,
});
export const mapApplication = (a) => ({
  id: a.id, name: a.name, email: a.email, phone: a.phone, degree: a.degree, institute: a.institute,
  cgpa: a.cgpa, research: a.research, skills: a.skills || [], coverNote: a.cover_note,
  status: a.status, appliedDate: a.applied_date,
  applicantType: a.applicant_type || 'internal',
  verified: a.email_verified_at !== null && a.email_verified_at !== undefined,
  resume: a.resume_path ? a.resume_path.split('/').pop() : '',
  resumePath: a.resume_path || '',
  position: a.position ? a.position.type : a.position_type,
  positionTitle: a.position ? a.position.title : a.position_title,
  projectId: a.project_id,
  projectTitle: a.position && a.position.project ? a.position.project.title : a.project_title,
  posKey: a.position_id,
});
export const mapProject = (p) => (p ? {
  id: p.id,
  title: p.title, category: p.category, role: p.role, status: p.status,
  amount: p.amount, description: p.description,
  canEdit: p.can_edit !== false,
  // Only the list sends it: how the viewer stands on the project.
  viewerRole: p.viewer_role,
  fundingAgency: p.funding_agency, tietShare: p.tiet_share,
  startDate: p.start_date, endDate: p.end_date,
  durationYears: p.duration_years, durationMonths: p.duration_months,
  focusArea: p.focus_area, grantType: p.grant_type,
  coPIs: p.co_pis || [], objectives: p.objectives || [], budget: p.budget || {},
  sdgs: p.sdgs || [],
  ganttChartName: p.gantt_chart_name || '',
  ganttChartPath: p.gantt_chart_path || '',
  sanctionLetterLink: p.sanction_letter_link, sanctionLetterName: p.sanction_letter_name,
  pi: p.pi ? {
    code: p.pi.faculty_code,
    name: p.pi.user ? `${p.pi.user.first_name || ''} ${p.pi.user.last_name || ''}`.trim() : '',
    department: p.pi.department ? p.pi.department.name : '',
    designation: p.pi.designation || '',
  } : null,
  milestones: (p.milestones || []).map(mapMilestone),
  documents: (p.documents || []).map(mapDocument),
  positions: (p.positions || []).map(mapPosition),
} : null);

// ---- projects CRUD ----
// null on failure, so a list that could not load is not read as an empty one.
export const apiListProjects = async (filters) => {
  const qs = filters ? `?filters=${encodeURIComponent(JSON.stringify(filters))}` : '';
  const { success, response } = await customFetch(`${baseURL}/projects${qs}`, 'GET', {}, false);
  return success ? (response || []).map(mapProject) : null;
};
export const apiProjectStats = async () => {
  const { success, response } = await customFetch(`${baseURL}/projects/stats`, 'GET', {}, false);
  return success ? response : { active: 0, completed: 0, totalFunding: 0, consultancy: 0, industry: 0, international: 0 };
};

// Option lists come from the backend so the wizard cannot drift from the
// validation. Cached for the life of the page — these change with a deploy,
// not with a click. A failure is not kept, or the wizard would stay without
// SDGs and budget heads until a reload.
let metaRequest = null;
export const apiProjectMeta = () => {
  if (!metaRequest) {
    metaRequest = customFetch(`${baseURL}/projects/meta`, 'GET', {}, false).then(({ success, response }) => {
      if (success) return response;
      metaRequest = null;
      return { sdgs: [], manpowerCategories: [], budgetHeads: [], duration: { years: [0, 1, 2, 3, 4, 5], maxMonths: 11 } };
    });
  }
  return metaRequest;
};
// `failed` means the request got no answer, so the project may still exist and
// a retry can help; no project without it means the server refused or has none.
export const apiGetProject = async (id) => {
  const { success, response, status } = await customFetch(`${baseURL}/projects/${id}`, 'GET', {}, false);
  // A 404 or 403 means there is no project to show; anything else is worth a retry.
  return { project: success ? mapProject(response) : null, failed: !success && status !== 404 && status !== 403 };
};
export const apiUpdateProject = async (id, body, isFormData = false) => {
  return customFetch(`${baseURL}/projects/${id}`, 'POST', body, true, isFormData);
};
export const apiDeleteProject = async (id) => customFetch(`${baseURL}/projects/${id}`, 'DELETE');

// ---- milestones ----
export const apiAddMilestone = (projectId, m) => customFetch(`${baseURL}/projects/${projectId}/milestones`, 'POST',
  { name: m.name, deliverable: m.deliverable, due_date: m.dueDate || null, status: m.status }, true);
export const apiUpdateMilestone = (projectId, milestoneId, m) => customFetch(`${baseURL}/projects/${projectId}/milestones/${milestoneId}`, 'POST',
  { name: m.name, deliverable: m.deliverable, due_date: m.dueDate || null, status: m.status }, true);
export const apiDeleteMilestone = (projectId, milestoneId) => customFetch(`${baseURL}/projects/${projectId}/milestones/${milestoneId}`, 'DELETE');

// ---- Gantt chart ----
export const apiUploadGanttChart = (projectId, file) => {
  const body = new FormData();
  body.append('gantt_chart', file);
  return customFetch(`${baseURL}/projects/${projectId}`, 'POST', body, true, true);
};
export const apiRemoveGanttChart = (projectId) =>
  customFetch(`${baseURL}/projects/${projectId}`, 'POST', { remove_gantt_chart: 1 }, true);

// ---- documents ----
export const apiAddDocument = (projectId, formData) => customFetch(`${baseURL}/projects/${projectId}/documents`, 'POST', formData, true, true);
export const apiUpdateDocument = (projectId, documentId, formData) => customFetch(`${baseURL}/projects/${projectId}/documents/${documentId}`, 'POST', formData, true, true);
export const apiDeleteDocument = (projectId, documentId) => customFetch(`${baseURL}/projects/${projectId}/documents/${documentId}`, 'DELETE');

// ---- positions ----
export const apiListPositions = async (projectId) => {
  const { success, response } = await customFetch(`${baseURL}/projects/${projectId}/positions`, 'GET', {}, false);
  return success ? (response || []).map(mapPosition) : [];
};
const isForm = (body) => body instanceof FormData;
export const apiAddPosition = (projectId, body) => customFetch(`${baseURL}/projects/${projectId}/positions`, 'POST', body, true, isForm(body));
export const apiUpdatePosition = (projectId, positionId, body) => customFetch(`${baseURL}/projects/${projectId}/positions/${positionId}`, 'POST', body, true, isForm(body));
export const apiDeletePosition = (projectId, positionId) => customFetch(`${baseURL}/projects/${projectId}/positions/${positionId}`, 'DELETE');

// ---- applications (faculty) ----
export const apiListApplications = async (projectId) => {
  const { success, response } = await customFetch(`${baseURL}/projects/${projectId}/applications`, 'GET', {}, false);
  return success ? (response || []).map(mapApplication) : [];
};
export const apiSetApplicationStatus = (applicationId, status) => customFetch(`${baseURL}/applications/${applicationId}/status`, 'POST', { status }, true);
