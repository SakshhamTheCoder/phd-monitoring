import React, { useEffect, useState } from "react";
import Layout from "../../components/dashboard/layout";
import SupervisorAllocation from "../../components/forms/supervisorAllocation/SupervisorAllocation";
import "./forms.css";
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
const MainFormPage = () => {
  const [formData, setFormData] = useState({});
  const { setLoading } = useLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();
  const { form_type } = useParams();

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

  return (
    <Layout
      children={
        <>
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
                 //fix yaha p
                    case "thesis-extension":
                    return <ThesisSubmission formData={formData} />
                  case "revise-title":
                    return <ReviseTitle formData={formData}/>
                  default:
                    return <p>Are You Sure this is a FORM?</p>;
                }
              })()}
            </>
          )}
        </>
      }
    />
  );
};

export default MainFormPage;
