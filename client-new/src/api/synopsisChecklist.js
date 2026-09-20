import { baseURL } from './urls';
import { customFetch } from './base';

// The declarations a scholar picks one of on their synopsis, one set per
// admission year. Admin only: a scholar's own options ship with their form.
const CHECKLIST = `${baseURL}/synopsis-checklist`;

export const apiChecklistList = () => customFetch(CHECKLIST, 'GET', {});
export const apiChecklistCreate = (body) => customFetch(CHECKLIST, 'POST', body, true);
export const apiChecklistUpdate = (id, body) => customFetch(`${CHECKLIST}/${id}`, 'PATCH', body, true);
export const apiChecklistDelete = (id) => customFetch(`${CHECKLIST}/${id}`, 'DELETE', {}, true);
