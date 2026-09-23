// Student-facing job portal API (browse openings across projects, apply, track applications).
import { baseURL } from './urls';
import { customFetch } from './base';
import { mapPosition, mapApplication } from './projects';

// The two lists answer null on failure, so a page can tell "none" from "could not ask".
export const apiOpenings = async () => {
  const { success, response } = await customFetch(`${baseURL}/openings`, 'GET', {}, false);
  return success ? (response || []).map(mapPosition) : null;
};

export const apiApply = (positionId, formData) =>
  customFetch(`${baseURL}/openings/${positionId}/apply`, 'POST', formData, true, true);

export const apiMyApplications = async () => {
  const { success, response } = await customFetch(`${baseURL}/my-applications`, 'GET', {}, false);
  return success ? (response || []).map(mapApplication) : null;
};

export const apiApplicantProfile = async () => {
  const { success, response } = await customFetch(`${baseURL}/openings/profile`, 'GET', {}, false);
  return success ? (response || {}) : {};
};
