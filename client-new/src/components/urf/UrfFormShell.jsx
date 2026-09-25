import React, { useEffect, useState } from 'react';
import ServerForm from '../forms/serverForm/ServerForm';
import LoadError from '../common/LoadError';
import { useLoading } from '../../context/LoadingContext';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';

/**
 * One URF form, read the way a PhD form is read, from the server's description
 * of it (App\Forms\UrfFormDefinition), as the app reads it too: the title bar
 * with its id, stage and status view, what the student filed, locked, then the
 * recommendation of each step up to the reader's own, each posting to the
 * form's decision endpoint.
 *
 * `path` is the form's API path. It is the page's own path on the URF pages,
 * and passed in where the student reads the same form under /forms.
 */
const UrfFormShell = ({ path }) => {
  const [formData, setFormData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { setLoading } = useLoading();

  useEffect(() => {
    let cancelled = false;
    // Another form starts clean, so the last one is neither shown nor decided
    // under this path.
    setFormData(null);
    setFailed(false);
    setLoading(true);
    customFetch(baseURL + path, 'GET')
      .then((res) => {
        if (cancelled) return;
        if (res.success) setFormData(res.response);
        else setFailed(true);
      })
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [path, attempt]);

  if (failed) {
    return <LoadError message="Could not load this form. Check your connection and try again." onRetry={() => setAttempt((n) => n + 1)} />;
  }
  if (!formData) return null;

  return (
    <div className="page">
      <ServerForm formData={formData} />
    </div>
  );
};

export default UrfFormShell;
