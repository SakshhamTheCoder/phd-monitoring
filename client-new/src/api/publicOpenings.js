// Public job portal. Plain fetch, not customFetch: there is no account here, so a
// 401 anywhere else must never redirect an applicant to the login page.
import { baseURL } from './urls';

const get = async (path) => {
  const res = await fetch(`${baseURL}${path}`, { headers: { Accept: 'application/json' } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
};

export const apiPublicOpenings = () => get('/public/openings');
export const apiPublicOpening = (id) => get(`/public/openings/${id}`);
export const apiApplicationStatus = (token) => get(`/public/applications/${token}`);

export const apiPublicApply = async (id, formData) => {
  const res = await fetch(`${baseURL}/public/openings/${id}/apply`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: formData,
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
};

export const apiVerifyApplication = async (token) => {
  const res = await fetch(`${baseURL}/public/applications/${token}/verify`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, body };
};
