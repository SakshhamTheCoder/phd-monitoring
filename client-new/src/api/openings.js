// Student-facing job portal API (browse openings across projects, apply, track applications).
import { baseURL } from './urls';
import { customFetch } from './base';
import { mapPosition, mapApplication } from './projects';

export const apiOpenings = async () => {
  const { success, response } = await customFetch(`${baseURL}/openings`, 'GET', {}, false);
  return success ? (response || []).map(mapPosition) : [];
};

export const apiApply = (positionId, formData) =>
  customFetch(`${baseURL}/openings/${positionId}/apply`, 'POST', formData, true, true);

export const apiMyApplications = async () => {
  const { success, response } = await customFetch(`${baseURL}/my-applications`, 'GET', {}, false);
  return success ? (response || []).map(mapApplication) : [];
};

export const apiApplicantProfile = async () => {
  const { success, response } = await customFetch(`${baseURL}/openings/profile`, 'GET', {}, false);
  return success ? (response || {}) : {};
};
