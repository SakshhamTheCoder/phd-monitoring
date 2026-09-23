import React, { useEffect,useState } from 'react';
import FormGrid from '../../components/forms/formGrid/FormGrid';
import { customFetch } from '../../api/base';
import { baseURL } from '../../api/urls';
import { useLoading } from '../../context/LoadingContext';
import { useLocation } from 'react-router-dom';



const FormsPage = () => {
    const { setLoading } = useLoading();
    const [forms, setForms] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const location = useLocation();

    // One request. A second one for the scholar's profile fed only a component
    // that is commented out, and the two raced for the page-wide loader.
    useEffect(() => {
      setLoading(true);
      customFetch(baseURL + location.pathname, "GET")
        .then((data) => {
          if (data && data.success) setForms(data.response);
        })
        .finally(() => {
          setLoading(false);
          setLoaded(true);
        });
    }, [location.pathname]);

  return (
    <FormGrid forms={forms} loading={!loaded} />
  );
}

export default FormsPage;
