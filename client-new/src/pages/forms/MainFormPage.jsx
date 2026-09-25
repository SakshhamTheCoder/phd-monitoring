import React, { Suspense, lazy, useEffect, useState } from "react";
import { useLoading } from "../../context/LoadingContext";
import { useLocation, useParams } from "react-router-dom";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import ServerForm from "../../components/forms/serverForm/ServerForm";
import useScholarInPath from "../../hooks/useScholarInPath";
import Loader from "../../components/loader/loader";
import LoadError from "../../components/common/LoadError";
import StatusNotice from "../../components/common/StatusNotice";

// Lazy because it brings react-datepicker and its stylesheet, which no other
// form on this page needs.
const StudentLeave = lazy(() => import("../../components/forms/studentLeave/StudentLeave"));

const MainFormPage = () => {
  const [formData, setFormData] = useState({});
  const { setLoading } = useLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  // Bumped by "Try again" to run the load once more.
  const [attempt, setAttempt] = useState(0);
  const location = useLocation();
  const scholar = useScholarInPath();
  const { form_type } = useParams();

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

  // A form page is a page like any other: header band, then the form panel,
  // with the page's gap between them. The form components draw both.
  return (
    <div className="page">
      {scholar && (
        <p className="viewing-scholar">
          You are viewing <strong>{scholar.label}</strong>'s form.
        </p>
      )}
      {loadFailed && (
        <LoadError
          message="Could not load this form. Check your connection and try again."
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )}
      {isLoaded && formData && (
        <>
          {(() => {
            // A form the server describes draws from that description; one
            // laid out in sections (a leave application) keeps its own page.
            if (formData.view && !formData.view.sections) return <ServerForm formData={formData} />;
            switch (form_type) {
              // The API serves /forms/student-leave/:id, and StudentLeave
              // defaults submitPath to the current location, which is that
              // endpoint. Without this the canonical URL fell through to the
              // unknown-form notice.
              case "student-leave":
                return (
                  <Suspense fallback={<Loader scope="content" />}>
                    <StudentLeave formData={formData} />
                  </Suspense>
                );
              default:
                return (
                  <StatusNotice tone="warning" title="This is not a form the portal knows">
                    Check the link, or open the form from your list of forms.
                  </StatusNotice>
                );
            }
          })()}
        </>
      )}
    </div>
  );
};

export default MainFormPage;
