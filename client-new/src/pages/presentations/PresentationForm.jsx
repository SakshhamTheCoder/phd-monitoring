import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import PresentationForm from "../../components/forms/presentations/PresentationForm";
import { useLoading } from "../../context/LoadingContext";
import { useLocation, useParams } from "react-router-dom";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";

const Presentation = () => {
  const [formData, setFormData] = useState({});
  const { setLoading } = useLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();
  // Back and forward between two forms reuse this page, so the old form is
  // dropped and a late answer for it is ignored. A failed load is toasted by
  // customFetch.
  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setLoading(true);
    customFetch(baseURL + location.pathname, "GET").then((data) => {
      if (cancelled) return;
      if (data.success) {
        setFormData(data.response);
        setIsLoaded(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [location.pathname]);
  const refetchData = () => {
    setLoading(true);
    const url = baseURL + location.pathname;
    customFetch(url, "GET")
      .then((data) => {
        if (data && data.success) {
          setFormData(data.response);
          setIsLoaded(true);
        }
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
      });
  }
  return (
    <>
      <Layout
        children={
          <>
            {isLoaded && formData && (
              <>
                <PresentationForm formData={formData} refetchData={refetchData}
                
                />
              </>
            )}
          </>
        }
      />
    </>
  );
};
export default Presentation;
