import React, { useEffect,useState } from 'react';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';
import LoadError from '../../components/common/LoadError';
import Page from '../../components/page/Page';



const FormsPage = () => {
    const { setLoading } = useLoading();
    const [forms, setForms] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    // Bumped by "Try again" to run the load once more.
    const [attempt, setAttempt] = useState(0);
    const location = useLocation();

    // One request. A second one for the scholar's profile fed only a component
    // that is commented out, and the two raced for the page-wide loader.
    // This page is reused from one scholar's forms to the next, so the old
    // grid is dropped and a late answer for the previous path is ignored.
    useEffect(() => {
      let cancelled = false;
      setForms([]);
      setLoaded(false);
      setLoadFailed(false);
      setLoading(true);
      customFetch(baseURL + location.pathname, "GET").then((data) => {
        if (cancelled) return;
        if (data.success) setForms(data.response);
        else setLoadFailed(true);
        setLoaded(true);
        setLoading(false);
      });
      return () => {
        cancelled = true;
        setLoading(false);
      };
    }, [location.pathname, attempt]);

  return (
    <Page title="Forms">
      {loadFailed ? (
        <LoadError
          message="Could not load the forms. Check your connection and try again."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : (
        <FormGrid forms={forms} loading={!loaded} />
      )}
    </Page>
  );
}

export default FormsPage;
