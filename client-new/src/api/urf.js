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
export const apiUrfDepartments = () => customFetch(`${URF}/departments`, 'GET', {}, true);
export const apiUrfShow = (id) => customFetch(`${URF}/${id}`, 'GET', {}, true, false, false);
export const apiUrfApply = (body) => customFetch(URF, 'POST', toFormData(body), true, true);
export const apiUrfFellow = (id, body) => customFetch(`${URF}/${id}/fellow`, 'POST', body, true);
export const apiUrfReport = (id, body) => customFetch(`${URF}/${id}/reports`, 'POST', toFormData(body), true, true);
export const apiUrfStatus = (id, status) => customFetch(`${URF}/${id}/status`, 'POST', { status }, true);
