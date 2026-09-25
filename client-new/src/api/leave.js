import { baseURL } from './urls';
import { customFetch } from './base';

const LEAVE = `${baseURL}/forms/student-leave`;

// Every application, page by page. The list is paged on the server (50 a page
// by default), and asking for the first page alone left later pending
// applications off the Leave Requests page.
export const apiLeaveList = async () => {
  const pageOf = (page) => customFetch(`${LEAVE}?page=${page}&rows=100`, 'GET', {}, true);
  const first = await pageOf(1);
  if (!first.success) return first;
  const rows = [...(first.response.data || [])];
  for (let page = 2; page <= (first.response.totalPages || 1); page += 1) {
    const next = await pageOf(page);
    if (!next.success) return next;
    rows.push(...(next.response.data || []));
  }
  return { ...first, response: { ...first.response, data: rows } };
};
export const apiLeaveCreate = () => customFetch(LEAVE, 'POST', {}, true);
export const apiLeaveLoad = (id) => customFetch(`${LEAVE}/${id}`, 'GET', {}, true);
export const apiLeaveBalance = () => customFetch(`${LEAVE}/balance`, 'GET', {}, true);
export const apiLeaveDelete = (id) => customFetch(`${LEAVE}/${id}`, 'DELETE', {}, true);

// Multipart, because an academic leave carries a PDF.
export const apiLeaveSubmit = (id, formData) =>
  customFetch(`${LEAVE}/${id}`, 'POST', formData, true, true);
