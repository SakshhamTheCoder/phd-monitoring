// Uploaded documents are served only to signed-in users who may read the
// record they belong to (server FileController). A plain <a href> cannot send
// the bearer token, so every stored file is opened through openStoredFile.
import { toast } from 'react-toastify';
import { baseURL } from './urls';

const isExternalLink = (path) => /^https?:\/\//i.test(path);

// Where a stored path is served from. External links pass through unchanged.
export const storedFileUrl = (path) => {
  const value = String(path || '').trim();
  if (!value || isExternalLink(value)) return value;
  return `${baseURL}/files?path=${encodeURIComponent(value)}`;
};

// Shown in a tab only when the browser renders them without running code: a
// blob opened in a tab runs with this site's origin, so HTML or SVG is saved.
const VIEWABLE_TYPES = /^(application\/pdf|image\/(png|jpe?g|gif|webp)|text\/plain)\b/i;

const failureMessage = (status) => {
  if (status === 401) return 'Your session has ended. Sign in again to open this file.';
  if (status === 403) return 'You do not have access to this file.';
  if (status === 404) return 'This file is no longer on the server. Ask for it to be uploaded again.';
  return 'Could not open the file. Check your connection and try again.';
};

const saveBlob = (url, fileName) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
};

// Opens a stored file in a new tab, or saves it when asked to or when the
// browser cannot show it. Failures surface as a toast, never a blank tab.
export const openStoredFile = async (path, { download = false } = {}) => {
  const value = String(path || '').trim();
  if (!value) return;
  if (isExternalLink(value)) {
    window.open(value, '_blank', 'noopener,noreferrer');
    return;
  }

  // Opened while the click still counts as a user action; a tab opened after
  // the fetch resolves is blocked as a popup.
  const tab = download ? null : window.open('', '_blank');
  try {
    const response = await fetch(storedFileUrl(value), {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    });
    if (!response.ok) {
      tab?.close();
      toast.error(failureMessage(response.status));
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    if (tab && VIEWABLE_TYPES.test(blob.type)) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      tab?.close();
      saveBlob(url, value.split('/').pop());
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch {
    tab?.close();
    toast.error(failureMessage());
  }
};

// onClick for an <a href={storedFileUrl(path)}>: keeps the row click from
// firing too, and opens the file with the token instead of navigating.
export const storedFileClick = (path, options) => (event) => {
  event.preventDefault();
  event.stopPropagation();
  openStoredFile(path, options);
};
