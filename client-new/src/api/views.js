import { useEffect, useState } from 'react';
import { customFetch } from './base';
import { baseURL } from './urls';
import { currentRole } from '../auth/access';

// A page as the server describes it for this reader (server: App\Pages, GET
// /views/{page}). A list's description changes with the role, not while it is
// open, so it is kept: in memory for the session, and in local storage so the
// next visit draws at once while the description is checked again behind it.
// A record carries its data and is read afresh each time it opens (`kept`
// false).
const views = new Map();
// Descriptions checked with the server this session; a stored one is not yet.
const checked = new Set();
const inFlight = new Map();

const STORED = 'view:';
const userId = () => {
  try {
    return JSON.parse(localStorage.getItem('user'))?.id ?? '';
  } catch {
    return '';
  }
};
const storageKey = (key) => `${STORED}${userId()}:${key}`;

const stored = (key) => {
  try {
    return JSON.parse(localStorage.getItem(storageKey(key)));
  } catch {
    return null;
  }
};

const keep = (key, view) => {
  views.set(key, view);
  checked.add(key);
  try {
    localStorage.setItem(storageKey(key), JSON.stringify(view));
  } catch {
    // Storage full or refused: the memory copy still serves this session.
  }
};

const viewKey = (page, query) => `${currentRole()}:${page}?${query}`;

// One request per description at a time, however many ask for it.
const fetchView = (page, query) => {
  const url = `${baseURL}/views/${page}${query ? `?${query}` : ''}`;
  if (!inFlight.has(url)) {
    inFlight.set(url, customFetch(url, 'GET', {}, false).finally(() => inFlight.delete(url)));
  }
  return inFlight.get(url);
};

/** Signing out forgets every kept description, so the next person starts clean. */
export const forgetViews = () => {
  views.clear();
  checked.clear();
  Object.keys(localStorage).filter((name) => name.startsWith(STORED)).forEach((name) => localStorage.removeItem(name));
};

/**
 * Every list the reader may open without route parameters, in one request
 * (GET /views), so the first visit to each opens without waiting for its
 * description. Once per role per session.
 */
let prefetchedFor = null;
export const prefetchViews = async () => {
  const role = currentRole();
  if (!role || prefetchedFor === role) return;
  prefetchedFor = role;
  const res = await customFetch(`${baseURL}/views`, 'GET', {}, false);
  if (!res?.success || currentRole() !== role) return;
  Object.entries(res.response.views || {}).forEach(([pageAndQuery, view]) => keep(`${role}:${pageAndQuery}`, view));
};

export const useView = (page, params = {}, { kept = true } = {}) => {
  const query = new URLSearchParams(params).toString();
  const key = viewKey(page, query);
  const known = () => (kept ? views.get(key) ?? stored(key) : null);
  const [answer, setAnswer] = useState(() => ({ key, view: known(), failed: false }));
  const [attempt, setAttempt] = useState(0);

  // Another page, or another role, is another description.
  if (answer.key !== key) setAnswer({ key, view: known(), failed: false });

  useEffect(() => {
    if (kept && checked.has(key)) {
      // Checked since this page was drawn from storage: take that answer.
      setAnswer((shown) => (shown.view === views.get(key) ? shown : { key, view: views.get(key), failed: false }));
      return undefined;
    }
    let cancelled = false;
    fetchView(page, query).then((res) => {
      if (cancelled) return;
      if (res?.success) {
        if (kept) keep(key, res.response);
        // A kept description that has not changed is not drawn again.
        setAnswer((shown) => (shown.view && JSON.stringify(shown.view) === JSON.stringify(res.response)
          ? shown
          : { key, view: res.response, failed: false }));
      } else {
        // A page already drawn from storage stays; with nothing drawn it is a failure.
        setAnswer((shown) => (shown.view ? shown : { key, view: null, failed: true }));
      }
    });
    return () => { cancelled = true; };
  }, [key, page, query, attempt, kept]);

  return {
    view: answer.key === key ? answer.view : null,
    failed: answer.key === key && answer.failed,
    retry: () => setAttempt((n) => n + 1),
    // Read again, keeping what is shown until the new answer lands.
    reload: () => {
      checked.delete(key);
      setAttempt((n) => n + 1);
    },
  };
};

// A path or message from a view with {key} filled from a table row, or
// {key|words} where the row leaves the key empty.
export const fillFromRow = (template, row) =>
  String(template ?? '').replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_, name, otherwise) => row?.[name] || otherwise || (row?.[name] ?? ''));
