import { baseURL } from './urls';
import { customFetch } from './base';

// The synopsis checklist: the conditions that decide which categories a scholar
// is offered, and the wording under each. Admin only: the options a scholar
// qualifies for ship with their form.
const CHECKLIST = `${baseURL}/synopsis-checklist`;

export const apiChecklistList = () => customFetch(CHECKLIST, 'GET', {});

export const apiChecklistRuleCreate = (body) => customFetch(`${CHECKLIST}/rules`, 'POST', body, true);
export const apiChecklistRuleUpdate = (id, body) => customFetch(`${CHECKLIST}/rules/${id}`, 'PATCH', body, true);
export const apiChecklistRuleDelete = (id) => customFetch(`${CHECKLIST}/rules/${id}`, 'DELETE', {}, true);

export const apiChecklistCreate = (body) => customFetch(CHECKLIST, 'POST', body, true);
export const apiChecklistUpdate = (id, body) => customFetch(`${CHECKLIST}/${id}`, 'PATCH', body, true);
export const apiChecklistDelete = (id) => customFetch(`${CHECKLIST}/${id}`, 'DELETE', {}, true);
