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
    const prefrences = (formData?.prefrences || []).map(
      (prefrence) => prefrence.faculty_code
    );
    if (prefrences.length < 3) {
      for (let i = prefrences.length; i < 3; i++) prefrences.push(null);
    }
    setBody({
      prefrences: prefrences,
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
                label="Roll number"
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
                label="Date of admission"
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
                label="Mobile number"
                initialValue={formData.phone}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="IRB completed"
                initialValue={formData.irb_submitted ? "Yes" : "No"}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              <InputField
                label="Title of PhD thesis"
                initialValue={formData.phd_title}
                isLocked={true}
              />,
            ]}
            space={2}
          />

          <GridContainer
            elements={(formData.supervisors || []).map((sup, index) => {
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
                label={"Date of allocation of supervisor"}
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
                label="Reason for supervisor change"
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

      {formData.role === "student" && !lock ? (
        <>
          <GridContainer
            label="Select supervisors to change"
            elements={(formData.supervisors || []).map((sup, index) => {
              const isSelected = selectedSupervisors.includes(sup.faculty_code);

              return (
                <button
                  type="button"
                  key={sup.faculty_code}
                  onClick={() => handleToggle(sup.faculty_code)}
                  aria-pressed={isSelected}
                  className={`supervisor-box ${isSelected ? "selected" : ""}`}
                >
                  {sup.name}
                </button>
              );
            })}
          />

          <GridContainer
            label="Select 3 tentative names of supervisors (in order)"
            elements={[
              <InputSuggestions
                initialValue={formData.prefrences?.[0]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 0)}
                lock={lock}
                label={"Preference 1"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences?.[1]?.name}
                apiUrl={apiUrl_suggestion}
                onSelect={(value) => handlePrefrenceSelect(value, 1)}
                lock={lock}
                label={"Preference 2"}
              />,
              <InputSuggestions
                initialValue={formData.prefrences?.[2]?.name}
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
          <GridContainer
            label="Supervisor(s) to be changed"
            elements={[
              <TableComponent
                data={formData.to_change}
                keys={["name", "department"]}
                titles={["Supervisor name", "Department"]}
              />,
            ]}
            space={3}
          />
          <GridContainer
            label="Student preferences"
            elements={[
              <TableComponent
                data={formData.prefrences}
                keys={["name", "department"]}
                titles={["Supervisor name", "Department"]}
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
