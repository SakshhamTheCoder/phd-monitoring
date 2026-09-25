// The Projects module's changes: a project, its milestones, files, positions
// and decisions. What the pages show is described by the server (App\Pages).
import { baseURL } from './urls';
import { customFetch } from './base';

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
