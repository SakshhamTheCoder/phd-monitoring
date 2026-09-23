import React, { useEffect, useState } from 'react';
import FormTitleBar from '../forms/formTitleBar/FormTitleBar';
import FormLadder from '../forms/formLadder/FormLadder';
import UrfFilled from './UrfFilled';
import LoadError from '../common/LoadError';
import { useLoading } from '../../context/LoadingContext';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';

/**
 * One URF form, read the way a PhD form is read: the title bar with its id,
 * stage and status view, then what was filled in, then the recommendation of
 * each step up to the reader's own. A student holds only the first step, so
 * they get their own answers and the history behind View status, as they do on
 * a PhD form.
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

  // A form page like any other: the header band, then the form panel, with the
  // page's gap between them.
  return (
    <div className="page">
      <FormTitleBar formName={formData.form_name} formData={formData} />
      <p className="viewing-scholar">
        URF {formData.session} · <strong>{formData.project_title}</strong>
      </p>
      <div className="form-container">
        <FormLadder
          formData={formData}
          panels={{ student: UrfFilled }}
          // Each step recommends; only the DORDC ends a project, and only on
          // the application. The decision posts to the form's own endpoint
          // rather than to whichever page the form is being read from.
          stepProps={Object.fromEntries(['mentor', 'adordc', 'dordc'].map((step) => [step, {
            allowRejection: step === 'dordc' && formData.may_reject,
            submitPath: `/urf/${formData.form}/${formData.form_id}/decision`,
          }]))}
        />
      </div>
    </div>
  );
};

export default UrfFormShell;
