import React, { useEffect, useState } from "react";
import GridContainer from "../../fields/GridContainer";
import InputField from "../../fields/InputField";
import { formatDate } from "../../../../utils/timeParse";
import CustomButton from "../../fields/CustomButton";
import FileUploadField from "../../fields/FileUploadField";
import DateField from "../../fields/DateField";
import { useLocation } from "react-router-dom";
import { submitForm } from "../../../../api/form";
import { useLoading } from "../../../../context/LoadingContext";

const Student = ({ formData }) => {
  const [body, setBody] = useState({});
  const [lock, setLock] = useState(formData?.locks?.student);
  const [isLoaded, setIsLoaded] = useState(true);
  const [files, setFiles] = useState([]);
  const location = useLocation();
  const { setLoading } = useLoading();

  // A second request needs the previous grant attached. The steps array
  // already carries this: createForm only adds 'director' when the student
  // has an earlier granted extension, the same check studentSubmit repeats
  // server side when it decides whether previous_extention_pdf is required.
  const isRepeatRequest = formData?.steps?.includes("director");

  useEffect(() => {
    setLock(formData?.locks?.student);
    setIsLoaded(true);
  }, []);

  const handleFileChange = (key, file) => {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.key !== key);
      return [...filtered, { key, file }];
    });
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
                label="Date of Admission"
                initialValue={formatDate(formData.date_of_registration)}
                isLocked={true}
              />,
              <InputField
                label="Department"
                initialValue={formData.department}
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
            elements={[
              <InputField
                label="Status of Student at Time of Admission"
                initialValue={formData.initial_status}
                isLocked={true}
              />,
              <InputField
                label="Date of Revised IRB"
                initialValue={formatDate(formData.date_of_irb)}
                isLocked={true}
              />,
            ]}
          />

          <GridContainer
            elements={[
              formData.date_of_synopsis ? (
                <InputField
                  label="Date of Synopsis Presentation"
                  initialValue={formatDate(formData.date_of_synopsis)}
                  isLocked={true}
                />
              ) : (
                <DateField
                  required={true}
                  label="Date of Synopsis Presentation"
                  initialValue={formData.date_of_synopsis}
                  isLocked={lock}
                  onChange={(value) => {
                    setBody((prev) => ({
                      ...prev,
                      date_of_synopsis: value,
                    }));
                  }}
                />
              ),
            ]}
            space={2}
          />

          <GridContainer
            elements={[
              <InputField
                required={true}
                label="Reason for Extension"
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

          {isRepeatRequest && (
            <GridContainer
              elements={[
                <FileUploadField
                  required={true}
                  label={"Upload Previous Extension Approval"}
                  onChange={(file) =>
                    handleFileChange("previous_extention_pdf", file)
                  }
                  isLocked={lock}
                  initialValue={formData.previous_extention_pdf}
                />,
              ]}
              space={2}
            />
          )}
        </>
      )}
      {formData?.role === "student" && !lock && (
        <GridContainer
          elements={[
            <CustomButton
              text="Submit"
              onClick={() => {
                submitForm(
                  body,
                  location,
                  setLoading,
                  files.length > 0 ? files : null
                );
              }}
            />,
          ]}
        />
      )}
    </div>
  );
};

export default Student;
