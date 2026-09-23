import { useEffect, useState } from "react";
import { formatDate } from "../../../../utils/timeParse";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import InputSuggestion from "../../fields/InputSuggestions";
import DropdownField from "../../fields/DropdownField";
import CustomButton from "../../fields/CustomButton";
import { submitForm } from "../../../../api/form";
import { useLocation } from "react-router-dom";
import { useLoading } from "../../../../context/LoadingContext";
import { baseURL } from "../../../../api/urls";
import TableComponent from "../../table/TableComponent";
import CounterField from "../../fields/CounterField";
import Recommendation from "../../layouts/Recommendation";
import { toast } from "react-toastify";


const Supervisor = ({ formData }) => {
  const [lock, setLock] = useState(formData.locks?.supervisor);
  const [body, setBody] = useState({});
  const [isLoaded, setIsLoaded] = useState(true);
  const [greater, setGreater] = useState(true);

  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    setLock(formData.locks?.supervisor);
    setBody({
      // The approval column defaults to 0, which would submit as "Not Recommend"
      // if Submit is pressed before choosing. Unanswered means nothing chosen.
      approval: formData.locks?.supervisor ? formData.approvals?.supervisor : null,
      supervised_outside: formData.current_supervisor?.supervised_outside,
    });
    setIsLoaded(true);
  }, [formData]);
  const handleApprovalChange = (value) => {
    setBody((prevBody) => ({
      ...prevBody,
      approval: value.approval,
      comments: value.comments,
    }));
  };
  return (
    <>
      {isLoaded && formData && (
        <>
          {!!lock && (
            <>
              <GridContainer
                label="Supervisors"
                elements={[
                  <TableComponent
                    data={formData.supervisors}
                    keys={[
                      "name",
                      "department",
                      "designation",
                      "supervised_campus",
                      "supervised_outside",
                    ]}
                    titles={[
                      "Name",
                      "Department",
                      "Designation",
                      "Supervised campus",
                      "Supervised outside",
                    ]}
                  />,
                ]}
                space={3}
              />
            </>
          )}
          <Recommendation
            formData={formData}
            role="supervisor"
            allowRejection={false}
            // The role draws its own Submit, which also sends supervised_outside,
            // so Recommendation must never add a second one, revised form or not.
            moreFields={true}
            handleRecommendationChange={handleApprovalChange}
          />
         
              {formData.role === "faculty" && !lock && (
                <>
                  <GridContainer
                    elements={[
                      <InputField required={true}
                        label="Name"
                        initialValue={formData.current_supervisor?.name}
                        onChange={(value) => {
                          setBody({ ...body, name: value });
                        }}
                        isLocked={true}
                      />,
                      <InputField required={true}
                        label="Department"
                        initialValue={formData.current_supervisor?.department}
                        onChange={(value) => {
                          setBody({ ...body, department: value });
                        }}
                        isLocked={true}
                      />,
                      <InputField required={true}
                        label="Designation"
                        initialValue={formData.current_supervisor?.designation}
                        onChange={(value) => {
                          setBody({ ...body, designation: value });
                        }}
                        isLocked={true}
                      />,
                    ]}
                  />
                  <GridContainer
                    label="Total number of students under guidance (including this applicant)"
                    elements={[
                      <CounterField
                        label="Inside TIET students"
                        initialValue={
                          formData.current_supervisor?.supervised_campus
                        }
                        isLocked={true}
                      />,
                      <CounterField required={true}
                        label="Outside TIET students"
                        initialValue={
                          formData.current_supervisor?.supervised_outside
                        }
                        isLocked={lock}
                        onChange={(value) => {
                          body.supervised_outside = value;
                        }}
                      />,
                    ]}
                  />
                </>
              )}
           

          {formData.role === "faculty" && !lock  &&(
            <>
              <GridContainer
                elements={[
                  <CustomButton
                    text="Submit"
                    onClick={() => {
                      if (body.approval === null || body.approval === undefined) {
                        toast.error("Choose Recommend or Not Recommend first.");
                        return;
                      }
                      submitForm(body, location, setLoading);
                    }}
                  />,
                ]}
              />
            </>
          )}
        </>
      )}
    </>
  );
};

export default Supervisor;
