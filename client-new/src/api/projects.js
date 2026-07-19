// API layer for the Projects module. Wraps customFetch and maps between the
// backend's snake_case shape and the camelCase shape the React pages expect.
import { baseURL, rootURL } from './urls';
import { customFetch } from './base';

// Turn a stored `/app/public/...` path into a servable URL; pass links through.
export const fileUrl = (p) => {
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  return rootURL + String(p).replace('app/public', 'storage');
};

// ---- mappers: backend -> frontend ----
export const mapMilestone = (m) => ({
  id: m.id, name: m.name, deliverable: m.deliverable, dueDate: m.due_date, status: m.status,
});
export const mapDocument = (d) => ({
  id: d.id, name: d.name, type: d.type, date: d.doc_date,
  url: d.file_path ? fileUrl(d.file_path) : d.link, file_path: d.file_path, link: d.link,
});
export const mapPosition = (p) => ({
  id: p.id, type: p.type, title: p.title, openings: p.openings, stipend: p.stipend,
  deadline: p.deadline, eligibility: p.eligibility, skills: p.skills, cgpa: p.min_cgpa,
  description: p.description, advertisementPath: p.advertisement_path,
  applicants: p.applications_count ?? p.applicants ?? 0,
  shortlisted: p.shortlisted_count ?? p.shortlisted ?? 0,
  projectId: p.project_id, projectTitle: p.project ? p.project.title : p.project_title,
});
export const mapApplication = (a) => ({
  id: a.id, name: a.name, email: a.email, phone: a.phone, degree: a.degree, institute: a.institute,
  cgpa: a.cgpa, research: a.research, skills: a.skills || [], coverNote: a.cover_note,
  status: a.status, appliedDate: a.applied_date,
  resume: a.resume_path ? a.resume_path.split('/').pop() : '',
  resumeUrl: a.resume_path ? fileUrl(a.resume_path) : '',
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
  fundingAgency: p.funding_agency, tietShare: p.tiet_share,
  startDate: p.start_date, endDate: p.end_date,
  durationYears: p.duration_years, durationMonths: p.duration_months,
  focusArea: p.focus_area, grantType: p.grant_type,
  coPIs: p.co_pis || [], objectives: p.objectives || [], budget: p.budget || {},
  equipmentDetails: p.equipment_details || [],
  sanctionLetterLink: p.sanction_letter_link, sanctionLetterName: p.sanction_letter_name,
  pi: p.pi || null,
  milestones: (p.milestones || []).map(mapMilestone),
  documents: (p.documents || []).map(mapDocument),
  positions: (p.positions || []).map(mapPosition),
} : null);

// ---- mapper: frontend wizard form -> backend project body ----
export const toProjectBody = (form) => ({
  title: form.title,
  category: form.category,
  funding_agency: form.fundingAgency,
  description: form.description,
  start_date: form.startDate || null,
  end_date: form.endDate || null,
  duration_years: parseInt(form.durationYears) || 0,
  duration_months: parseInt(form.durationMonths) || 0,
  amount: parseInt(form.sanctionAmount) || 0,
  tiet_share: parseInt(form.tietShare) || 0,
  co_pis: form.coPIs || [],
  objectives: form.objectives || [],
  budget: form.budget || {},
});

// ---- projects CRUD ----
export const apiListProjects = async () => {
  const { success, response } = await customFetch(`${baseURL}/projects`, 'GET', {}, false);
  return success ? (response || []).map(mapProject) : [];
};
export const apiProjectStats = async () => {
  const { success, response } = await customFetch(`${baseURL}/projects/stats`, 'GET', {}, false);
  return success ? response : { active: 0, completed: 0, totalFunding: 0, consultancy: 0, industry: 0, international: 0 };
};
export const apiGetProject = async (id) => {
  const { success, response } = await customFetch(`${baseURL}/projects/${id}`, 'GET', {}, false);
  return success ? mapProject(response) : null;
};
export const apiCreateProject = async (form) => {
  const res = await customFetch(`${baseURL}/projects`, 'POST', toProjectBody(form), false);
  if (!res.success) return { success: false };
  const project = res.response;
  // milestones live in their own table — create them after the project exists
  for (const m of (form.milestones || [])) {
    if (m && m.name && m.name.trim()) {
      await customFetch(`${baseURL}/projects/${project.id}/milestones`, 'POST', {
        name: m.name, deliverable: m.deliverable, due_date: m.dueDate || null, status: m.status,
      }, false);
    }
  }
  return { success: true, project: mapProject(project) };
};
export const apiUpdateProjectFromForm = async (id, form) => {
  const res = await customFetch(`${baseURL}/projects/${id}`, 'POST', toProjectBody(form), true);
  return res.success ? { success: true, project: mapProject(res.response.project || res.response) } : { success: false };
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

// ---- documents ----
export const apiAddDocument = (projectId, formData) => customFetch(`${baseURL}/projects/${projectId}/documents`, 'POST', formData, true, true);
export const apiUpdateDocument = (projectId, documentId, formData) => customFetch(`${baseURL}/projects/${projectId}/documents/${documentId}`, 'POST', formData, true, true);
export const apiDeleteDocument = (projectId, documentId) => customFetch(`${baseURL}/projects/${projectId}/documents/${documentId}`, 'DELETE');

// ---- positions ----
export const apiListPositions = async (projectId) => {
  const { success, response } = await customFetch(`${baseURL}/projects/${projectId}/positions`, 'GET', {}, false);
  return success ? (response || []).map(mapPosition) : [];
};
export const apiAddPosition = (projectId, body) => customFetch(`${baseURL}/projects/${projectId}/positions`, 'POST', body, true);
export const apiUpdatePosition = (projectId, positionId, body) => customFetch(`${baseURL}/projects/${projectId}/positions/${positionId}`, 'POST', body, true);
export const apiDeletePosition = (projectId, positionId) => customFetch(`${baseURL}/projects/${projectId}/positions/${positionId}`, 'DELETE');

// ---- applications (faculty) ----
export const apiListApplications = async (projectId) => {
  const { success, response } = await customFetch(`${baseURL}/projects/${projectId}/applications`, 'GET', {}, false);
  return success ? (response || []).map(mapApplication) : [];
};
export const apiSetApplicationStatus = (applicationId, status) => customFetch(`${baseURL}/applications/${applicationId}/status`, 'POST', { status }, true);
