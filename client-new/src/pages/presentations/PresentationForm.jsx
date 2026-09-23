import React, { useEffect, useState } from "react";
import PresentationForm from "../../components/forms/presentations/PresentationForm";
import { useLoading } from "../../context/LoadingContext";
import { useLocation, useParams } from "react-router-dom";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import LoadError from "../../components/common/LoadError";

const Presentation = () => {
  const [formData, setFormData] = useState({});
  const { setLoading } = useLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by "Try again" to run the load once more.
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  // Back and forward between two forms reuse this page, so the old form is
  // dropped and a late answer for it is ignored. A failed load is toasted by
  // customFetch.
  useEffect(() => {
    let cancelled = false;
    setIsLoaded(false);
    setLoadFailed(false);
    setLoading(true);
    customFetch(baseURL + location.pathname, "GET").then((data) => {
      if (cancelled) return;
      if (data.success) {
        setFormData(data.response);
        setIsLoaded(true);
      } else {
        setLoadFailed(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
      setLoading(false);
    };
  }, [location.pathname, attempt]);
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
  // A page like any other: the form draws its header and its panel, and the
  // page supplies the gap between them.
  return (
    <div className="page">
      {loadFailed && (
        <LoadError
          message="Could not load this progress monitoring form. Check your connection and try again."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {isLoaded && formData && (
        <PresentationForm formData={formData} refetchData={refetchData} />
      )}
    </div>
  );
};
export default Presentation;
