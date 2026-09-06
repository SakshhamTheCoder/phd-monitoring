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
  useEffect(() => {
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
        console.log(error);
        setLoading(false);
      });
  }, []);
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
        console.log(error);
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
