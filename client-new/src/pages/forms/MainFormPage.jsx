import React, { Suspense, lazy, useEffect, useState } from "react";
import SupervisorAllocation from "../../components/forms/supervisorAllocation/SupervisorAllocation";
import { useLoading } from "../../context/LoadingContext";
import { useLocation, useParams } from "react-router-dom";
import { customFetch } from "../../api/base";
import { baseURL } from "../../api/urls";
import ConstituteOfIRB from "../../components/forms/constituteOfIRB/ConstituteOfIRB";
import IRBSubmission from "../../components/forms/irbSubmission/IRBSubmission";
import PresentationForm from "../../components/forms/presentations/PresentationForm";
import SynopsisSubmission from "../../components/forms/synopsisSubmission/SynopsisSubmission";
import ThesisSubmission from "../../components/forms/thesisSubmission/ThesisSubmission";
import SemesterOff from "../../components/forms/semesterOff/SemesterOff";
import StatusChange from "../../components/forms/statusChange/StatusChange";
import IrbExtention from "../../components/forms/irbExtention/IrbExtention";
import SupervisorChange from "../../components/forms/supervisorChange/SupervisorChange";
import ListOfExaminers from "../../components/forms/listOfExaminers/ListOfExaminers";
import ReviseTitle from "../../components/forms/reviseTitle/ReviseTitle";
import ThesisExtention from "../../components/forms/thesisExtention/ThesisExtention";
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
            switch (form_type) {
              case "supervisor-allocation":
                return <SupervisorAllocation formData={formData} />;
              case "irb-constitution":
                return <ConstituteOfIRB formData={formData} />;
              case "irb-submission":
                return <IRBSubmission formData={formData} />;
              case "presentation":
                return <PresentationForm formData={formData} />;
              case "synopsis-submission":
                return <SynopsisSubmission formData={formData} />;
              case "thesis-submission":
                return <ThesisSubmission formData={formData} />;
              case "semester-off":
                return <SemesterOff formData={formData} />;
                case "status-change":
                  return <StatusChange formData={formData} />;
              case "irb-extension":
                return <IrbExtention formData={formData}/>
              case "supervisor-change":
                return <SupervisorChange formData={formData}/>
              case "list-of-examiners":
                return <ListOfExaminers formData={formData}/>
              case "thesis-extension":
                return <ThesisExtention formData={formData} />
              case "revise-title":
                return <ReviseTitle formData={formData}/>
              // The API serves /forms/student-leave/:id, and StudentLeave
              // defaults submitPath to the current location, which is that
              // endpoint. Without this the canonical URL fell through to the
              // unknown-form notice.
              case "student-leave":
                return (
                  <Suspense fallback={<Loader />}>
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
