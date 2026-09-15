import { toast } from "react-toastify";
import { baseURL, rootURL } from './urls';

const isHttpUrl = (value) => /^https?:\/\//i.test(value);
const isPublicUploadPath = (value) => /^\/?app\/public\//.test(value);

// Only safe as a plain <a href> for public/external paths; private paths need openStoredFile for the bearer token.
export const resolveFileUrl = (path) => {
  if (!path) return '';
  const value = String(path);
  if (isHttpUrl(value)) return value;
  if (isPublicUploadPath(value)) return rootURL + value.replace('app/public', 'storage');
  return `${baseURL}/files/download/${value.replace(/^\/?app\//, '')}`;
};

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
