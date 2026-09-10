import { useEffect, useState } from 'react';
import { baseURL } from '../api/urls';
import { customFetch } from '../api/base';

// What the acting role may do, from GET /my-roles.
//
// Used only to decide whether the UI offers an action. The API enforces the
// same capabilities on every request, so a stale or missing answer here costs
// a button, never access.
//
// Cached in localStorage because several pages ask on mount and the answer
// only changes when the role does; SwitchRole clears it.
const CACHE_KEY = 'capabilities';

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || null;
  } catch {
    return null;
  }
};

export const clearCapabilities = () => localStorage.removeItem(CACHE_KEY);

export const useCapabilities = () => {
  const [capabilities, setCapabilities] = useState(readCache);

  useEffect(() => {
    customFetch(`${baseURL}/my-roles`, 'GET', {}, true).then((data) => {
      if (!data?.success) return;
      const fresh = data.response.capabilities || {};
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      setCapabilities(fresh);
    });
  }, []);

  // Unknown reads as false, so the UI stays closed until the answer arrives.
  return (name) => Boolean(capabilities?.[name]);
};

export default useCapabilities;
