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
    const supervisors = formData?.new_supervisors.map(
      (Supervisor) => Supervisor.faculty_code
    );
    if (supervisors.length == 0) {
      supervisors.push(null);
    }
    setBody({
      new_supervisors: supervisors,
      approval: true,
    });
    setLock(formData.locks?.phd_coordinator);
    formData.role = "phd_coordinator";
    setIsLoaded(true);
  }, [formData]);

  const handleSupervisorSelect = (value, index) => {
    body.new_supervisors[index] = value.id;
  };
  const handleAddSupervisor = () => {
    console.log("Add Supervisor");
    setBody((prevBody) => ({
      ...prevBody,
      new_supervisors: [...prevBody.new_supervisors, ""],
    }));
  };
  return (
    <>
      {isLoaded && formData && (
        <>
          {formData.role === "phd_coordinator" && !lock ? (
            <>
              <GridContainer
                elements={[
                  <p>Allot Supervisors</p>,
                  <></>,
                  <CustomButton
                    text="Add Supervisor +"
                    onClick={handleAddSupervisor}
                  />,
                ]}
              />

              <GridContainer
                elements={body.new_supervisors.map((supervisor, index) => (
                  <InputSuggestions
                    apiUrl={apiUrl_suggestion}
                    label={`Supervisor ${index + 1}`}
                    initialValue={formData.new_supervisors[index]?.name}
                    onSelect={(value) => handleSupervisorSelect(value, index)}
                    lock={lock}
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
                elements={[
                  <p>Supervisors Allocated By PhDCoordinator</p>,
                ]}
                space={2}
              />
              <GridContainer elements={[
                <TableComponent 
                  data={formData.new_supervisors}
                  keys={[ "name", "department"]}
                  titles={[ "Name", "Department"]}

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
