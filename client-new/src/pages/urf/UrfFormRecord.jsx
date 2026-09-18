import React, { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import Layout from '../../components/dashboard/layout';
import FormTitleBar from '../../components/forms/formTitleBar/FormTitleBar';
import FormLadder from '../../components/forms/formLadder/FormLadder';
import UrfFilled from '../../components/urf/UrfFilled';
import { useLoading } from '../../context/LoadingContext';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import '../forms/forms.css';

/**
 * One URF form of one project, read the way a PhD form is read: the title bar
 * with its id, stage and status view, then what was filled in, then the
 * recommendation of each step up to the reader's own.
 *
 * The API path is the page's path, as the PhD form pages have it, so the form
 * this is loads from the URL rather than from a prop.
 */
const UrfFormRecord = () => {
  const { pathname } = useLocation();
  const { id } = useParams();
  const [formData, setFormData] = useState(null);
  const { setLoading } = useLoading();

  useEffect(() => {
    setLoading(true);
    customFetch(baseURL + pathname, 'GET')
      .then((res) => res?.success && setFormData(res.response))
      .finally(() => setLoading(false));
  }, [pathname]);

  return (
    <Layout>
      {formData && (
        <>
          <FormTitleBar formName={formData.form_name} formData={formData} />
          <p className="viewing-scholar">
            URF {formData.session} · <strong>{formData.project_title}</strong>
          </p>
          <div className="form-container">
            <FormLadder
              formData={formData}
              panels={{ student: UrfFilled }}
              // Each step recommends; only the DORDC ends a project, and only
              // on the application. The decision posts to the form's own
              // endpoint rather than to this page's path.
              stepProps={Object.fromEntries(['mentor', 'adordc', 'dordc'].map((step) => [step, {
                allowRejection: step === 'dordc' && formData.may_reject,
                submitPath: `/urf/${formData.form}/${id}/decision`,
              }]))}
            />
          </div>
        </>
      )}
    </Layout>
  );
};

export default UrfFormRecord;
