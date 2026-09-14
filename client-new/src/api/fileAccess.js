// Stored upload paths now come in two shapes: '/app/public/...' for the one
// artifact that is still meant to be public (job-opening advertisements), and
// '/app/...' for everything else, which moved off the web-served disk and
// behind the authenticated /files/download route (see server SaveFile.php).
import { toast } from "react-toastify";
import { baseURL, rootURL } from './urls';

const isHttpUrl = (value) => /^https?:\/\//i.test(value);
const isPublicUploadPath = (value) => /^\/?app\/public\//.test(value);

// The URL a stored path resolves to. Safe to use as a plain <a href> only for
// public paths and external links; private paths need openStoredFile instead,
// since a browser navigation cannot attach the bearer token they require.
export const resolveFileUrl = (path) => {
  if (!path) return '';
  const value = String(path);
  if (isHttpUrl(value)) return value;
  if (isPublicUploadPath(value)) return rootURL + value.replace('app/public', 'storage');
  return `${baseURL}/files/download/${value.replace(/^\/?app\//, '')}`;
};

// Open a stored file in a new tab. Public paths and external links navigate
// directly; private paths are fetched with the bearer token and opened from
// an object URL, since <a href> cannot carry an Authorization header.
export const openStoredFile = async (path) => {
  if (!path) return;
  const value = String(path);
  if (isHttpUrl(value) || isPublicUploadPath(value)) {
    window.open(resolveFileUrl(value), '_blank', 'noopener,noreferrer');
    return;
  }

  try {
    const response = await fetch(resolveFileUrl(value), {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!response.ok) {
      // 401/403 means the session or role can't reach this file; anything
      // else (404, 500, ...) is a fetch failure the user can only retry.
      const message =
        response.status === 401 || response.status === 403
          ? 'You do not have permission to do that. Contact your administrator if you believe this is a mistake.'
          : 'Could not open this file. Check your connection and try again.';
      toast.error(message);
      return;
    }
    const blob = await response.blob();
    window.open(URL.createObjectURL(blob), '_blank', 'noopener,noreferrer');
  } catch (error) {
    console.error('Could not open file:', error);
    toast.error('Could not open this file. Check your connection and try again.');
  }
};
