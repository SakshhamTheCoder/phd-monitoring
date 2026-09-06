import React, { useEffect, useState } from "react";
import InputSuggestions from "../../fields/InputSuggestions";
import { baseURL } from "../../../../api/urls";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import TableComponent from "../../table/TableComponent";
import CustomButton from "../../fields/CustomButton";
import { useLoading } from "../../../../context/LoadingContext";
import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";

const PhDCoordinator = ({ formData }) => {
  const apiUrl_suggestion = baseURL + "/suggestions/faculty";
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData.locks?.student);
  const { setLoading } = useLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const supervisors = formData?.supervisors.map(
      (Supervisor) => Supervisor.faculty_code
    );
    if (supervisors.length == 0) {
      supervisors.push(null);
    }
    setBody({
      supervisors: supervisors,
      approval: true,
    });
    setLock(formData.locks?.phd_coordinator);
    formData.role = "phd_coordinator";
    setIsLoaded(true);
  }, [formData]);

  const handleSupervisorSelect = (value, index) => {
    body.supervisors[index] = value.id;
  };
  const handleAddSupervisor = () => {
    console.log("Add Supervisor");
    setBody((prevBody) => ({
      ...prevBody,
      supervisors: [...prevBody.supervisors, ""],
    }));
  };
  return (
    <>
      {isLoaded && formData && (
        <>
          {formData.role === "phd_coordinator" && !lock ? (
            <>
              <GridContainer
              label={<p>Allot Supervisors</p>}
                elements={[
                  <></>,
                  <></>,
                  <CustomButton
                    text="Add Supervisor +"
                    onClick={handleAddSupervisor}
                  />,
                ]}
                
              />

              <GridContainer
                elements={body.supervisors.map((supervisor, index) => (
                  <InputSuggestions
                    apiUrl={apiUrl_suggestion}
                    label={`Supervisor ${index + 1}`}
                    initialValue={formData.supervisors[index]?.name}
                    onSelect={(value) => handleSupervisorSelect(value, index)}
                    lock={lock}
                    fields={["name","department"]} 
                  />
                ))}
              />
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
          ) : (
            <>
               
              <GridContainer 
              label={<p>Supervisors Allocated By PhDCoordinator</p>}
              elements={[
                <TableComponent 
                  data={formData.supervisors}
                  keys={[ "name", "department", "supervised_campus"]}
                  titles={[ "Name", "Department", "Students Supervised"]}

                  />,
              ]} space={3} />
            </>
          )}
        </>
      )}
    </>
  );
};

export default PhDCoordinator;
