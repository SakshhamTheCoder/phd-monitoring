import React, { useEffect, useState } from "react";
import InputSuggestions from "../../fields/InputSuggestions";
import { baseURL } from "../../../../api/urls";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import TableComponent from "../../table/TableComponent";
import CustomButton from "../../fields/CustomButton";

import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";

const Student = ({ formData }) => {
  const apiUrl_suggestion = baseURL + "/suggestions/faculty";

  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData.locks?.student);
  const [isLoaded, setIsLoaded] = useState(false);
  const location = useLocation();
  const { setLoading } = useLoading();

  useEffect(() => {
    const prefrences = formData?.prefrences?.map(
      (prefrence) => prefrence.faculty_code
    );
    if (prefrences.length < 3) {
      for (let i = prefrences.length; i < 3; i++) prefrences.push(null);
    }
    setBody({
      prefrences: prefrences,
      broad_area_of_research: formData.broad_area_of_research_id,
    });
    setLock(formData.locks?.student);
    setIsLoaded(true);
  }, [formData]);

  const [selectedSupervisors, setSelectedSupervisors] = useState([]);

  // Toggle selection of a supervisor
  const handleToggle = (faculty_code) => {
    setSelectedSupervisors((prevSelected) => {
      if (prevSelected.includes(faculty_code)) {
        return prevSelected.filter((code) => code !== faculty_code);
      } else {
        return [...prevSelected, faculty_code];
      }
    });
  };

  useEffect(() => {
   
    setBody((prev) => ({
      ...prev,
      to_change: selectedSupervisors,
    }));

  },[selectedSupervisors])

  const handlePrefrenceSelect = (value, index) => {
    body.prefrences[index] = value.id;
  };

  return (
    <div>
      {isLoaded && formData && (
        <>
          <GridContainer
            elements={[
              <InputField
                label="Roll Number"
                initialValue={formData.roll_no}
                isLocked={true}
              />,
              <InputField
                label="Name"
                initialValue={formData.name}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Date Of Admission"
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Email"
                initialValue={formData.email}
                isLocked={true}
              />,
              <InputField
                label="Mobile Number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="IRB Completed:"
                initialValue={formData.irb_submitted ? "Yes" : "No"}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Title of Phd Thesis"
                initialValue={formData.phd_title}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={formData.supervisors.map((sup, index) => {
              return (
                <InputField
                  label={"Supervisor " + (index + 1)}
                  isLocked={true}
                  initialValue={sup.name}
                />
              );
            })}
          />

          <GridContainer
            elements={[
              <InputField
                label={"Date of Allocation of Supervisor"}
                isLocked={true}
                initialValue={formatDate(formData.date_of_allocation)}
              />,
            ]}
          />
        </>
      )}

<GridContainer
            elements={[
              <InputField required={true}
                label="Reason for Supervisor Change"
                initialValue={formData.reason}
                isLocked={lock}
                onChange={(value) => {
                  setBody((prev) => ({
                    ...prev,
                    reason: value,
                  }));
                }}
              />,
            ]}
            space={2}
          />

      {!lock ? (
        <>
          <GridContainer
            elements={[<p>Select Supervisors to change</p>]}
            space={2}
          />
          <GridContainer
            elements={formData.supervisors.map((sup, index) => {
              const isSelected = selectedSupervisors.includes(sup.faculty_code);

              return (
                <div
                  key={sup.faculty_code}
                  onClick={() => handleToggle(sup.faculty_code)}
                  className={`supervisor-box ${isSelected ? "selected" : ""}`}
                >
                  {sup.name}
                </div>
              );
            })}
          />

          <GridContainer
            elements={[<p>Select 3 Tentative Name of Supervisor (in order)</p>]}
            space={2}
          />
          <GridContainer
            elements={[
              <InputSuggestions
                initialValue={formData.prefrences[0]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 0)}
                lock={lock}
                label={"Preference 1"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences[1]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 1)}
                lock={lock}
                label={"Preference 2"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences[2]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 2)}
                lock={lock}
                label={"Preference 3"}
              />,
            ]}
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
           <GridContainer elements={[<p>Supervisor(s) to be changed</p>]} space={2} />
          <GridContainer
            elements={[
              <TableComponent
                data={formData.to_change}
                keys={["name", "department"]}
                titles={["Supervisor Name", "Department"]}
              />,
            ]}
            space={3}
          />
          <GridContainer elements={[<p>Student Prefrences</p>]} space={2} />
          <GridContainer
            elements={[
              <TableComponent
                data={formData.prefrences}
                keys={["name", "department"]}
                titles={["Supervisor Name", "Department"]}
              />,
            ]}
            space={3}
          />
        </>
      )}
    </div>
  );
};

export default Student;
