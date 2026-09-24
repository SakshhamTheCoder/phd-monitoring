import { useEffect, useState } from 'react';
import { customFetch } from './base';
import { baseURL } from './urls';
import { currentRole } from '../auth/access';

// A page as the server describes it for this reader (server: App\Pages, GET
// /views/{page}). It changes with the role, not while a page is open, so it is
// read once per role and page and kept for the rest of the session.
const views = new Map();

export const useView = (page, params = {}) => {
  const query = new URLSearchParams(params).toString();
  const key = `${currentRole()}:${page}?${query}`;
  const [answer, setAnswer] = useState(() => ({ key, view: views.get(key) ?? null, failed: false }));
  const [attempt, setAttempt] = useState(0);

  // Another page, or another role, is another description.
  if (answer.key !== key) setAnswer({ key, view: views.get(key) ?? null, failed: false });

  useEffect(() => {
    if (views.has(key)) return undefined;
    let cancelled = false;
    customFetch(`${baseURL}/views/${page}${query ? `?${query}` : ''}`, 'GET', {}, false).then((res) => {
      if (cancelled) return;
      if (res?.success) views.set(key, res.response);
      setAnswer({ key, view: res?.success ? res.response : null, failed: !res?.success });
    });
    return () => { cancelled = true; };
  }, [key, page, query, attempt]);

  return {
    view: answer.key === key ? answer.view : null,
    failed: answer.key === key && answer.failed,
    retry: () => setAttempt((n) => n + 1),
    // Read again, keeping what is shown until the new answer lands.
    reload: () => {
      views.delete(key);
      setAttempt((n) => n + 1);
    },
  };
};

// A path or message from a view with {key} filled from a table row, or
// {key|words} where the row leaves the key empty.
export const fillFromRow = (template, row) =>
  String(template ?? '').replace(/\{(\w+)(?:\|([^}]*))?\}/g, (_, name, otherwise) => row?.[name] || otherwise || (row?.[name] ?? ''));
