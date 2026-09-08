import { baseURL } from './urls';
import { customFetch } from './base';

const LEAVE = `${baseURL}/forms/student-leave`;

export const apiLeaveList = () => customFetch(LEAVE, 'GET', {}, true);
export const apiLeaveCreate = () => customFetch(LEAVE, 'POST', {}, true);
export const apiLeaveLoad = (id) => customFetch(`${LEAVE}/${id}`, 'GET', {}, true);
export const apiLeaveBalance = () => customFetch(`${LEAVE}/balance`, 'GET', {}, true);

// Multipart, because an academic leave carries a PDF.
export const apiLeaveSubmit = (id, formData) =>
  customFetch(`${LEAVE}/${id}`, 'POST', formData, true, true);

export const apiLeaveSettings = () =>
  customFetch(`${baseURL}/clerks/leave-settings`, 'GET', {}, true);
export const apiSaveLeaveSettings = (values) =>
  customFetch(`${baseURL}/clerks/leave-settings`, 'POST', values, true);
