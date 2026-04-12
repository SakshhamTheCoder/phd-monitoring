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


const Doctoral = ({ formData }) => {
  const [lock, setLock] = useState(formData.locks?.supervisor);
  const [body, setBody] = useState({});
  const [isLoaded, setIsLoaded] = useState(true);
  const [greater, setGreater] = useState(true);

  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    setLock(formData.locks?.supervisor);
    setBody({
      approval: formData.approvals.supervisor,
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
          {formData.form_type === "revised" && (
            <>
              <p>Supervisors</p>
              <GridContainer
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
                      "Supervised Campus",
                      "Supervised Outside",
                    ]}
                  />,
                ]}
                space={3}
              />
            </>
          )}
          <Recommendation
            formData={formData}
            role="doctoral"
            allowRejection={false}
            moreFields={formData.form_type === "revised"  ? false : (true && !lock)}
            handleRecommendationChange={handleApprovalChange}
          />
          {body.approval && formData.form_type === "draft" && (
            <>
              {formData.role === "faculty" && (
                <>
                  <GridContainer
                    elements={[
                      <InputField required={true}
                        label="Name"
                        initialValue={formData.current_supervisor.name}
                        onChange={(value) => {
                          setBody({ ...body, name: value });
                        }}
                        isLocked={true}
                      />,
                      <InputField required={true}
                        label="Department"
                        initialValue={formData.current_supervisor.department}
                        onChange={(value) => {
                          setBody({ ...body, department: value });
                        }}
                        isLocked={true}
                      />,
                      <InputField required={true}
                        label="Designation"
                        initialValue={formData.current_supervisor.designation}
                        onChange={(value) => {
                          setBody({ ...body, designation: value });
                        }}
                        isLocked={true}
                      />,
                    ]}
                  />
                  <>
                    Total Number of Students under Guidance (including this
                    applicant)
                  </>
                  <GridContainer
                    elements={[
                      <CounterField
                        label="Inside TIET Students"
                        initialValue={
                          formData.current_supervisor.supervised_campus
                        }
                        isLocked={true}
                      />,
                      <CounterField required={true}
                        label="Outside TIET Students"
                        initialValue={
                          formData.current_supervisor.supervised_outside
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
            </>
          )}

          {formData.role === "doctoral" && !lock && (
            <>
              <GridContainer
                elements={[
                  <CustomButton
                    text="Submit"
                    onClick={() => {
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

export default Doctoral;
