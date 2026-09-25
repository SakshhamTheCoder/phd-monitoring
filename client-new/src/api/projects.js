// API layer for the Projects module. Wraps customFetch and maps between the
// backend's snake_case shape and the camelCase shape the React pages expect.
import { baseURL } from './urls';
import { customFetch } from './base';

// ---- mappers: backend -> frontend ----
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
// ---- projects CRUD ----
export const apiUpdateProject = async (id, body, isFormData = false) => {
  return customFetch(`${baseURL}/projects/${id}`, 'POST', body, true, isFormData);
};

// ---- milestones ----
export const apiAddMilestone = (projectId, m) => customFetch(`${baseURL}/projects/${projectId}/milestones`, 'POST',
  { name: m.name, deliverable: m.deliverable, due_date: m.dueDate || null, status: m.status }, true);
export const apiUpdateMilestone = (projectId, milestoneId, m) => customFetch(`${baseURL}/projects/${projectId}/milestones/${milestoneId}`, 'POST',
  { name: m.name, deliverable: m.deliverable, due_date: m.dueDate || null, status: m.status }, true);
// ---- Gantt chart ----
export const apiUploadGanttChart = (projectId, file) => {
  const body = new FormData();
  body.append('gantt_chart', file);
  return customFetch(`${baseURL}/projects/${projectId}`, 'POST', body, true, true);
};
// ---- documents ----
export const apiAddDocument = (projectId, formData) => customFetch(`${baseURL}/projects/${projectId}/documents`, 'POST', formData, true, true);
export const apiUpdateDocument = (projectId, documentId, formData) => customFetch(`${baseURL}/projects/${projectId}/documents/${documentId}`, 'POST', formData, true, true);
export const apiDeleteDocument = (projectId, documentId) => customFetch(`${baseURL}/projects/${projectId}/documents/${documentId}`, 'DELETE');

// ---- positions ----
const isForm = (body) => body instanceof FormData;
export const apiAddPosition = (projectId, body) => customFetch(`${baseURL}/projects/${projectId}/positions`, 'POST', body, true, isForm(body));
export const apiUpdatePosition = (projectId, positionId, body) => customFetch(`${baseURL}/projects/${projectId}/positions/${positionId}`, 'POST', body, true, isForm(body));
export const apiDeletePosition = (projectId, positionId) => customFetch(`${baseURL}/projects/${projectId}/positions/${positionId}`, 'DELETE');

// ---- applications (faculty) ----
export const apiSetApplicationStatus = (applicationId, status) => customFetch(`${baseURL}/applications/${applicationId}/status`, 'POST', { status }, true);
