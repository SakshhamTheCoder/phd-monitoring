// Public job portal. Plain fetch, not customFetch: there is no account here, so a
// 401 anywhere else must never redirect an applicant to the login page.
import { baseURL } from './urls';
import { NETWORK_ERROR_MESSAGE } from './base';

// fetch rejects when the request never reached the server. That comes back as a
// failed answer carrying the network message, so a page says "check your
// connection" rather than "this link is not valid".
const request = async (path, options = {}) => {
  try {
    const res = await fetch(`${baseURL}${path}`, { ...options, headers: { Accept: 'application/json' } });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, body };
  } catch {
    return { ok: false, body: { message: NETWORK_ERROR_MESSAGE } };
  }
};

export const apiPublicOpenings = () => request('/public/openings');
export const apiPublicOpening = (id) => request(`/public/openings/${id}`);
export const apiApplicationStatus = (token) => request(`/public/applications/${token}`);

export const apiPublicApply = (id, formData) =>
  request(`/public/openings/${id}/apply`, { method: 'POST', body: formData });

export const apiVerifyApplication = (token) =>
  request(`/public/applications/${token}/verify`, { method: 'POST' });
