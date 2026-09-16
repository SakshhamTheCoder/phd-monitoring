import { baseURL } from './urls';
import { customFetch } from './base';

const URF = `${baseURL}/urf`;

// Blank fields are left out rather than sent as the string "undefined".
const toFormData = (body) => {
  const data = new FormData();
  Object.entries(body).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') data.append(key, value);
  });
  return data;
};

export const apiUrfMine = () => customFetch(`${URF}/mine`, 'GET', {}, true, false, false);
export const apiUrfBranches = () => customFetch(`${URF}/branches`, 'GET', {}, true);
export const apiUrfUpdateMine = (body) => customFetch(`${URF}/me`, 'PATCH', body, true);

// The office's list of UG students, and the records behind it.
const UG_STUDENTS = `${baseURL}/ug-students`;
export const apiUgStudentCreate = (body) => customFetch(UG_STUDENTS, 'POST', body, true);
export const apiUgStudentUpdate = (id, body) => customFetch(`${UG_STUDENTS}/${id}`, 'PATCH', body, true);
export const apiUgStudentImport = (rows) => customFetch(`${UG_STUDENTS}/import`, 'POST', { rows }, false);
export const apiUrfSessions = () => customFetch(`${URF}/sessions`, 'GET', {}, true);
export const apiUrfShow = (id) => customFetch(`${URF}/${id}`, 'GET', {}, true, false, false);
export const apiUrfApply = (body) => customFetch(URF, 'POST', toFormData(body), true, true);
export const apiUrfFellow = (id, body) => customFetch(`${URF}/${id}/fellow`, 'POST', body, true);
export const apiUrfReport = (id, body) => customFetch(`${URF}/${id}/reports`, 'POST', toFormData(body), true, true);
export const apiUrfStatus = (id, status) => customFetch(`${URF}/${id}/status`, 'POST', { status }, true);

// Sign-up, before there is an account. The toast is left to the page, which
// says what went wrong field by field.
export const apiUrfSignup = (body) => customFetch(`${URF}/signup`, 'POST', body, false);
export const apiUrfResendVerification = (email) => customFetch(`${URF}/resend-verification`, 'POST', { email }, false);

// The branch list as the admin manages it, with how many students are on each.
const BRANCHES = `${baseURL}/ug-branches`;
export const apiBranchList = () => customFetch(BRANCHES, 'GET', {}, true, false, false);
export const apiBranchCreate = (body) => customFetch(BRANCHES, 'POST', body, true);
export const apiBranchUpdate = (id, body) => customFetch(`${BRANCHES}/${id}`, 'PATCH', body, true);
export const apiBranchDelete = (id) => customFetch(`${BRANCHES}/${id}`, 'DELETE', {}, true);
// The whole list at once, which is how it arrives the first time.
export const apiBranchImport = (rows) => customFetch(`${BRANCHES}/import`, 'POST', { rows }, false);
