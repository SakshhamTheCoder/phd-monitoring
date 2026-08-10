import { baseURL } from './urls';
import { customFetch } from './base';

// AddPublication labels patents "patents"; the table stores the singular.
const toBackendType = (t) => (t === 'patents' ? 'patent' : t);

export const apiResearchProfile = async (facultyCode) => {
  const { success, response } = await customFetch(`${baseURL}/faculty/${facultyCode}/profile`, 'GET', {}, false);
  return success ? response : null;
};

export const apiUpdateResearchProfile = (facultyCode, body) =>
  customFetch(`${baseURL}/faculty/${facultyCode}/profile`, 'POST', body, true);

export const apiSyncPublications = (facultyCode) =>
  customFetch(`${baseURL}/faculty/${facultyCode}/profile/sync`, 'POST', {}, true);

export const apiAddFacultyPublication = (facultyCode, body) =>
  customFetch(`${baseURL}/faculty/${facultyCode}/publications`, 'POST',
    { ...body, publication_type: toBackendType(body.publication_type) }, true);

export const apiUpdateFacultyPublication = (facultyCode, id, body) =>
  customFetch(`${baseURL}/faculty/${facultyCode}/publications/${id}`, 'POST',
    { ...body, publication_type: toBackendType(body.publication_type) }, true);

export const apiDeleteFacultyPublication = (facultyCode, id) =>
  customFetch(`${baseURL}/faculty/${facultyCode}/publications/${id}`, 'DELETE');
